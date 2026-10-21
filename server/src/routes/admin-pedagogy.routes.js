import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

const idSchema = z.coerce.number().int().positive();

const moduleSchema = z
  .object({
    courseId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: z.string().trim().max(20000).nullable().optional(),
    position: z.number().int().min(1).max(1000),
    isPublished: z.boolean().optional().default(false),
  })
  .strict();

const moduleUpdateSchema = moduleSchema
  .omit({ courseId: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

const lessonSchema = z
  .object({
    moduleId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: z.string().trim().max(20000).nullable().optional(),
    objectives: z.string().trim().max(20000).nullable().optional(),
    preparationContent: z.string().max(50000).nullable().optional(),
    content: z.string().max(100000).nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    position: z.number().int().min(1).max(1000),
    isPublished: z.boolean().optional().default(false),
  })
  .strict();

const lessonUpdateSchema = lessonSchema
  .omit({ moduleId: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

const cohortLessonSchema = z
  .object({
    cohortId: z.number().int().positive(),
    lessonId: z.number().int().positive(),
    scheduledAt: z.string().datetime({ offset: true }),
    scheduledEndAt: z.string().datetime({ offset: true }),
    preparationLeadMinutes: z
      .number()
      .int()
      .min(0)
      .max(10080)
      .optional()
      .default(30),
    status: z
      .enum(["SCHEDULED", "RESCHEDULED", "CANCELLED"])
      .optional()
      .default("SCHEDULED"),
    instructorNotes: z.string().max(20000).nullable().optional(),
  })
  .strict();

const cohortLessonUpdateSchema = cohortLessonSchema
  .omit({ cohortId: true, lessonId: true })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);

function parseId(value) {
  const parsed = idSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function fail(res, status, code, message) {
  return res.status(status).json({
    error: {
      code,
      message,
    },
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

function handleError(res, error, operation) {
  if (error?.code === "P2002") {
    return fail(
      res,
      409,
      "DUPLICATE_POSITION",
      "An item already uses this position in the selected module or course.",
    );
  }

  if (error?.code === "P2003") {
    return fail(
      res,
      400,
      "INVALID_RELATION",
      "A referenced record does not exist.",
    );
  }

  console.error(`${operation} failed:`, error.message);

  return fail(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "Unable to complete this operation.",
  );
}

function validateSessionDates(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    return false;
  }

  return true;
}

/**
 * Publication is controlled by administrators.
 * Modules and lessons may only be published when their parent program
 * has approvalStatus APPROVED.
 *
 * This helper is used only when a request explicitly sets isPublished=true.
 * It does not prevent ordinary edits to existing content.
 */
function isPublishingUnapprovedProgram(isPublished, approvalStatus) {
  return isPublished === true && approvalStatus !== "APPROVED";
}

// -----------------------------------------------------------------------------
// MODULES
// -----------------------------------------------------------------------------

// GET /api/admin/pedagogy/modules?courseId=1
router.get("/modules", requireAdmin, async (req, res) => {
  const courseId = parseId(req.query.courseId);

  if (!courseId) {
    return fail(
      res,
      400,
      "INVALID_COURSE_ID",
      "Provide a valid courseId query parameter.",
    );
  }

  try {
    const data = await prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { position: "asc" },
      include: {
        lessons: {
          orderBy: { position: "asc" },
          include: {
            _count: {
              select: {
                resources: true,
                assessments: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      data,
      count: data.length,
    });
  } catch (error) {
    return handleError(res, error, "Admin module listing");
  }
});

// POST /api/admin/pedagogy/modules
router.post("/modules", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = moduleSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: parsed.data.courseId },
      select: {
        id: true,
        approvalStatus: true,
      },
    });

    if (!course) {
      return fail(res, 404, "COURSE_NOT_FOUND", "Course not found.");
    }

    if (
      isPublishingUnapprovedProgram(
        parsed.data.isPublished,
        course.approvalStatus,
      )
    ) {
      return fail(
        res,
        409,
        "COURSE_NOT_APPROVED",
        "Modules can only be published within an approved program.",
      );
    }

    const data = await prisma.courseModule.create({
      data: parsed.data,
    });

    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Admin module creation");
  }
});

// PATCH /api/admin/pedagogy/modules/:id
router.patch(
  "/modules/:id",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
      return fail(res, 400, "INVALID_MODULE_ID", "Provide a valid module ID.");
    }

    const parsed = moduleUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    try {
      const existing = await prisma.courseModule.findUnique({
        where: { id },
        select: {
          id: true,
          course: {
            select: {
              approvalStatus: true,
            },
          },
        },
      });

      if (!existing) {
        return fail(res, 404, "MODULE_NOT_FOUND", "Module not found.");
      }

      if (
        isPublishingUnapprovedProgram(
          parsed.data.isPublished,
          existing.course.approvalStatus,
        )
      ) {
        return fail(
          res,
          409,
          "COURSE_NOT_APPROVED",
          "Modules can only be published within an approved program.",
        );
      }

      const data = await prisma.courseModule.update({
        where: { id },
        data: parsed.data,
      });

      return res.json({ data });
    } catch (error) {
      return handleError(res, error, "Admin module update");
    }
  },
);

// -----------------------------------------------------------------------------
// LESSONS
// -----------------------------------------------------------------------------

// POST /api/admin/pedagogy/lessons
router.post("/lessons", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = lessonSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const module = await prisma.courseModule.findUnique({
      where: { id: parsed.data.moduleId },
      select: {
        id: true,
        course: {
          select: {
            approvalStatus: true,
          },
        },
      },
    });

    if (!module) {
      return fail(res, 404, "MODULE_NOT_FOUND", "Module not found.");
    }

    if (
      isPublishingUnapprovedProgram(
        parsed.data.isPublished,
        module.course.approvalStatus,
      )
    ) {
      return fail(
        res,
        409,
        "COURSE_NOT_APPROVED",
        "Lessons can only be published within an approved program.",
      );
    }

    const data = await prisma.lesson.create({
      data: parsed.data,
    });

    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Admin lesson creation");
  }
});

// PATCH /api/admin/pedagogy/lessons/:id
router.patch(
  "/lessons/:id",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
      return fail(res, 400, "INVALID_LESSON_ID", "Provide a valid lesson ID.");
    }

    const parsed = lessonUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    try {
      const existing = await prisma.lesson.findUnique({
        where: { id },
        select: {
          id: true,
          module: {
            select: {
              course: {
                select: {
                  approvalStatus: true,
                },
              },
            },
          },
        },
      });

      if (!existing) {
        return fail(res, 404, "LESSON_NOT_FOUND", "Lesson not found.");
      }

      if (
        isPublishingUnapprovedProgram(
          parsed.data.isPublished,
          existing.module.course.approvalStatus,
        )
      ) {
        return fail(
          res,
          409,
          "COURSE_NOT_APPROVED",
          "Lessons can only be published within an approved program.",
        );
      }

      const data = await prisma.lesson.update({
        where: { id },
        data: parsed.data,
      });

      return res.json({ data });
    } catch (error) {
      return handleError(res, error, "Admin lesson update");
    }
  },
);

// -----------------------------------------------------------------------------
// COHORT SESSIONS
// -----------------------------------------------------------------------------

// GET /api/admin/pedagogy/cohorts/:cohortId/sessions
router.get("/cohorts/:cohortId/sessions", requireAdmin, async (req, res) => {
  const cohortId = parseId(req.params.cohortId);

  if (!cohortId) {
    return fail(res, 400, "INVALID_COHORT_ID", "Provide a valid cohort ID.");
  }

  try {
    const data = await prisma.cohortLesson.findMany({
      where: { cohortId },
      orderBy: { scheduledAt: "asc" },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            position: true,
            module: {
              select: {
                id: true,
                title: true,
                courseId: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      data,
      count: data.length,
    });
  } catch (error) {
    return handleError(res, error, "Admin cohort session listing");
  }
});

// POST /api/admin/pedagogy/sessions
router.post("/sessions", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = cohortLessonSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  const input = parsed.data;

  if (!validateSessionDates(input.scheduledAt, input.scheduledEndAt)) {
    return fail(
      res,
      400,
      "INVALID_SESSION_DATES",
      "The session end time must be later than its start time.",
    );
  }

  try {
    const [cohort, lesson] = await Promise.all([
      prisma.cohort.findUnique({
        where: { id: input.cohortId },
        select: {
          id: true,
          courseId: true,
        },
      }),
      prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: {
          id: true,
          isPublished: true,
          module: {
            select: {
              courseId: true,
              course: {
                select: {
                  approvalStatus: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!cohort) {
      return fail(res, 404, "COHORT_NOT_FOUND", "Cohort not found.");
    }

    if (!lesson) {
      return fail(res, 404, "LESSON_NOT_FOUND", "Lesson not found.");
    }

    if (cohort.courseId !== lesson.module.courseId) {
      return fail(
        res,
        400,
        "LESSON_COURSE_MISMATCH",
        "The lesson must belong to the course assigned to this cohort.",
      );
    }

    if (
      lesson.module.course.approvalStatus !== "APPROVED" &&
      input.status !== "CANCELLED"
    ) {
      return fail(
        res,
        409,
        "COURSE_NOT_APPROVED",
        "Sessions can only be scheduled for an approved program.",
      );
    }

    if (!lesson.isPublished && input.status !== "CANCELLED") {
      return fail(
        res,
        400,
        "LESSON_NOT_PUBLISHED",
        "Publish the lesson before scheduling it for students.",
      );
    }

    const data = await prisma.cohortLesson.create({
      data: {
        ...input,
        scheduledAt: new Date(input.scheduledAt),
        scheduledEndAt: new Date(input.scheduledEndAt),
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Admin session scheduling");
  }
});

// PATCH /api/admin/pedagogy/sessions/:id
router.patch(
  "/sessions/:id",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
      return fail(
        res,
        400,
        "INVALID_SESSION_ID",
        "Provide a valid session ID.",
      );
    }

    const parsed = cohortLessonUpdateSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    try {
      const existing = await prisma.cohortLesson.findUnique({
        where: { id },
        select: {
          id: true,
          cohortId: true,
          lessonId: true,
          scheduledAt: true,
          scheduledEndAt: true,
          status: true,
          cohort: {
            select: {
              courseId: true,
            },
          },
          lesson: {
            select: {
              isPublished: true,
              module: {
                select: {
                  courseId: true,
                  course: {
                    select: {
                      approvalStatus: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!existing) {
        return fail(
          res,
          404,
          "SESSION_NOT_FOUND",
          "Scheduled session not found.",
        );
      }

      const nextStart =
        parsed.data.scheduledAt ?? existing.scheduledAt.toISOString();
      const nextEnd =
        parsed.data.scheduledEndAt ?? existing.scheduledEndAt.toISOString();

      if (!validateSessionDates(nextStart, nextEnd)) {
        return fail(
          res,
          400,
          "INVALID_SESSION_DATES",
          "The session end time must be later than its start time.",
        );
      }

      const nextStatus = parsed.data.status ?? existing.status;

      if (existing.cohort.courseId !== existing.lesson.module.courseId) {
        return fail(
          res,
          400,
          "LESSON_COURSE_MISMATCH",
          "The lesson must belong to the course assigned to this cohort.",
        );
      }

      if (
        nextStatus !== "CANCELLED" &&
        existing.lesson.module.course.approvalStatus !== "APPROVED"
      ) {
        return fail(
          res,
          409,
          "COURSE_NOT_APPROVED",
          "Sessions can only remain scheduled for an approved program.",
        );
      }

      if (nextStatus !== "CANCELLED" && !existing.lesson.isPublished) {
        return fail(
          res,
          400,
          "LESSON_NOT_PUBLISHED",
          "Publish the lesson before scheduling it for students.",
        );
      }

      const updateData = { ...parsed.data };

      if (parsed.data.scheduledAt) {
        updateData.scheduledAt = new Date(parsed.data.scheduledAt);
      }

      if (parsed.data.scheduledEndAt) {
        updateData.scheduledEndAt = new Date(parsed.data.scheduledEndAt);
      }

      const data = await prisma.cohortLesson.update({
        where: { id },
        data: updateData,
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return res.json({ data });
    } catch (error) {
      return handleError(res, error, "Admin session update");
    }
  },
);

export default router;
