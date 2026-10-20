import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireInstructor);

const idSchema = z.coerce.number().int().positive();

const meetingSchema = z
  .object({
    meetingProvider: z.enum(["GOOGLE_MEET", "ZOOM", "WHATSAPP"]).nullable(),
    meetingUrl: z.string().trim().max(2048).url().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if ((data.meetingProvider === null) !== (data.meetingUrl === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provider and meeting URL must both be set or both be cleared.",
        path: ["meetingUrl"],
      });
    }

    if (data.meetingUrl) {
      try {
        const url = new URL(data.meetingUrl);

        if (!["http:", "https:"].includes(url.protocol)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Meeting URL must use HTTP or HTTPS.",
            path: ["meetingUrl"],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid meeting URL.",
          path: ["meetingUrl"],
        });
      }
    }
  });

const attendanceSchema = z
  .object({
    records: z
      .array(
        z
          .object({
            enrollmentId: z.number().int().positive(),
            status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
            note: z.string().trim().max(500).nullable().optional(),
          })
          .strict(),
      )
      .max(8)
      .refine(
        (records) =>
          new Set(records.map((record) => record.enrollmentId)).size ===
          records.length,
        "Each enrollment may appear only once.",
      ),
  })
  .strict();

function fail(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function validationError(res, error) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Please review the submitted information.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

function parseId(value) {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function findOwnedSession(id, instructorId) {
  return prisma.cohortLesson.findFirst({
    where: {
      id,
      cohort: { instructorId },
    },
    select: {
      id: true,
      cohortId: true,
      meetingProvider: true,
      meetingUrl: true,
      cohort: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

// PATCH /api/instructor/sessions/:id/meeting
router.patch("/:id/meeting", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_SESSION_ID", "Invalid session ID.");
  }

  const parsed = meetingSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const session = await findOwnedSession(id, req.instructor.id);

    if (!session) {
      return fail(res, 404, "SESSION_NOT_FOUND", "Session not found.");
    }

    const data = await prisma.cohortLesson.update({
      where: { id },
      data: {
        meetingProvider: parsed.data.meetingProvider,
        meetingUrl: parsed.data.meetingUrl,
      },
      select: {
        id: true,
        meetingProvider: true,
        meetingUrl: true,
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error("Instructor meeting update failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to update the meeting link.",
    );
  }
});

// GET /api/instructor/sessions/:id/attendance
router.get("/:id/attendance", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_SESSION_ID", "Invalid session ID.");
  }

  try {
    const session = await prisma.cohortLesson.findFirst({
      where: {
        id,
        cohort: { instructorId: req.instructor.id },
      },
      select: {
        id: true,
        scheduledAt: true,
        scheduledEndAt: true,
        cohort: {
          select: {
            id: true,
            name: true,
            enrollments: {
              where: { status: "CONFIRMED" },
              orderBy: [{ enrolledAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
                guestFullName: true,
                guestEmail: true,
                guestPhone: true,
              },
            },
          },
        },
        attendance: {
          select: {
            enrollmentId: true,
            status: true,
            note: true,
            markedAt: true,
          },
        },
      },
    });

    if (!session) {
      return fail(res, 404, "SESSION_NOT_FOUND", "Session not found.");
    }

    const attendanceByEnrollment = new Map(
      session.attendance.map((record) => [record.enrollmentId, record]),
    );

    const students = session.cohort.enrollments.map((enrollment) => {
      const record = attendanceByEnrollment.get(enrollment.id);

      return {
        enrollmentId: enrollment.id,
        fullName:
          enrollment.user?.fullName ||
          enrollment.guestFullName ||
          "Guest student",
        email: enrollment.user?.email || enrollment.guestEmail,
        phone: enrollment.guestPhone,
        status: record?.status ?? null,
        note: record?.note ?? "",
        markedAt: record?.markedAt ?? null,
      };
    });

    return res.json({
      data: {
        sessionId: session.id,
        cohortId: session.cohort.id,
        cohortName: session.cohort.name,
        scheduledAt: session.scheduledAt,
        scheduledEndAt: session.scheduledEndAt,
        students,
      },
    });
  } catch (error) {
    console.error("Instructor attendance listing failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load attendance records.",
    );
  }
});

// PUT /api/instructor/sessions/:id/attendance
router.put("/:id/attendance", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_SESSION_ID", "Invalid session ID.");
  }

  const parsed = attendanceSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const session = await prisma.cohortLesson.findFirst({
      where: {
        id,
        cohort: { instructorId: req.instructor.id },
      },
      select: {
        id: true,
        cohortId: true,
      },
    });

    if (!session) {
      return fail(res, 404, "SESSION_NOT_FOUND", "Session not found.");
    }

    const records = parsed.data.records;
    const enrollmentIds = records.map((record) => record.enrollmentId);

    if (enrollmentIds.length > 0) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          id: { in: enrollmentIds },
          cohortId: session.cohortId,
          status: "CONFIRMED",
        },
        select: { id: true },
      });

      if (enrollments.length !== enrollmentIds.length) {
        return fail(
          res,
          400,
          "INVALID_ENROLLMENTS",
          "Every student must have a confirmed enrollment in this cohort.",
        );
      }
    }

    await prisma.$transaction(
      records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: {
            enrollmentId_cohortLessonId: {
              enrollmentId: record.enrollmentId,
              cohortLessonId: session.id,
            },
          },
          create: {
            enrollmentId: record.enrollmentId,
            cohortLessonId: session.id,
            status: record.status,
            note: record.note ?? null,
            markedById: req.instructor.id,
            markedAt: new Date(),
          },
          update: {
            status: record.status,
            note: record.note ?? null,
            markedById: req.instructor.id,
            markedAt: new Date(),
          },
        }),
      ),
    );

    return res.json({
      data: {
        sessionId: session.id,
        savedCount: records.length,
      },
    });
  } catch (error) {
    console.error("Instructor attendance save failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to save attendance records.",
    );
  }
});

export default router;
