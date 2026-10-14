import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

const activeEnrollmentStatuses = {
  notIn: ["CANCELLED", "WAITLISTED"],
};

const cohortStatuses = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Provide a valid calendar date.");

const deadlineSchema = z.string().datetime({ offset: true }).nullable();

const createSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    courseId: z.number().int().positive(),
    instructorId: z.number().int().positive().nullable().optional(),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    enrollmentDeadline: deadlineSchema.optional(),
    scheduleDescription: z.string().trim().min(3).max(255),
    timezone: z.string().trim().min(1).max(50).default("Africa/Douala"),
    capacity: z.number().int().min(1).max(500).default(8),
    minimumStudents: z.number().int().min(1).max(500).default(6),
    priceXaf: z.number().int().min(0).max(100000000).nullable().optional(),
    status: z.enum(cohortStatuses).default("DRAFT"),
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    instructorId: z.number().int().positive().nullable().optional(),
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.optional(),
    enrollmentDeadline: deadlineSchema.optional(),
    scheduleDescription: z.string().trim().min(3).max(255).optional(),
    timezone: z.string().trim().min(1).max(50).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    minimumStudents: z.number().int().min(1).max(500).optional(),
    priceXaf: z.number().int().min(0).max(100000000).nullable().optional(),
    status: z.enum(cohortStatuses).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  });

function parseId(value) {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function validationError(res, error) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Please review the submitted cohort information.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

function handleDatabaseError(res, error, operation) {
  console.error(`${operation} failed:`, error.message);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to complete this cohort operation.",
    },
  });
}

function toDateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayLocal() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function serializeCohort(cohort) {
  const { enrollments, ...data } = cohort;
  const enrolledCount = enrollments.length;

  return {
    ...data,
    enrolledCount,
    seatsRemaining: Math.max(0, data.capacity - enrolledCount),
    effectivePriceXaf: data.priceXaf ?? data.course.priceXaf,
  };
}

function cohortInclude() {
  return {
    course: {
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        examType: true,
        priceXaf: true,
        isPublished: true,
      },
    },
    instructor: {
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
      },
    },
    enrollments: {
      where: {
        status: activeEnrollmentStatuses,
      },
      select: { id: true },
    },
  };
}

async function validateInstructor(instructorId) {
  if (instructorId == null) {
    return { valid: true };
  }

  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: { id: true, role: true, isActive: true },
  });

  if (!instructor || !instructor.isActive) {
    return {
      valid: false,
      message: "The selected instructor does not exist or is inactive.",
    };
  }

  if (instructor.role !== "INSTRUCTOR") {
    return {
      valid: false,
      message: "The selected user is not an instructor.",
    };
  }

  return { valid: true };
}

function validateDates(startDate, endDate, enrollmentDeadline) {
  if (endDate < startDate) {
    return "The cohort end date must be on or after its start date.";
  }

  if (
    enrollmentDeadline &&
    new Date(enrollmentDeadline).getTime() >
      toDateOnly(startDate).getTime() + 24 * 60 * 60 * 1000 - 1
  ) {
    return "The enrollment deadline cannot be after the cohort start date.";
  }

  return null;
}

function isFutureStartDate(startDate) {
  return toDateOnly(startDate).getTime() >= todayLocal().getTime();
}

function isDeadlineOpen(enrollmentDeadline) {
  return (
    !enrollmentDeadline || new Date(enrollmentDeadline).getTime() >= Date.now()
  );
}

// GET /api/admin/cohorts
// Supports optional ?status=OPEN and ?courseId=123 filters.
router.get("/", requireAdmin, async (req, res) => {
  const querySchema = z.object({
    status: z.enum(cohortStatuses).optional(),
    courseId: z.coerce.number().int().positive().optional(),
  });

  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const cohorts = await prisma.cohort.findMany({
      where: {
        ...(parsed.data.status && { status: parsed.data.status }),
        ...(parsed.data.courseId && { courseId: parsed.data.courseId }),
      },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
      include: {
        ...cohortInclude(),
        _count: {
          select: { enrollments: true },
        },
      },
    });

    const data = cohorts.map((cohort) => {
      const { _count, ...rest } = cohort;
      return {
        ...serializeCohort(rest),
        totalEnrollmentRecords: _count.enrollments,
      };
    });

    return res.status(200).json({ data, count: data.length });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin cohort listing");
  }
});

// GET /api/admin/cohorts/:id
router.get("/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: {
        code: "INVALID_COHORT_ID",
        message: "Please provide a valid cohort ID.",
      },
    });
  }

  try {
    const cohort = await prisma.cohort.findUnique({
      where: { id },
      include: {
        ...cohortInclude(),
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!cohort) {
      return res.status(404).json({
        error: {
          code: "COHORT_NOT_FOUND",
          message: "The requested cohort was not found.",
        },
      });
    }

    const { _count, ...rest } = cohort;

    return res.status(200).json({
      data: {
        ...serializeCohort(rest),
        totalEnrollmentRecords: _count.enrollments,
      },
    });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin cohort details");
  }
});

// POST /api/admin/cohorts
router.post("/", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  const input = parsed.data;

  if (input.status === "OPEN" && input.instructorId == null) {
    return res.status(400).json({
      error: {
        code: "INSTRUCTOR_REQUIRED",
        message: "Assign an active instructor before opening cohort enrolment.",
      },
    });
  }

  const dateError = validateDates(
    input.startDate,
    input.endDate,
    input.enrollmentDeadline,
  );

  if (dateError) {
    return res.status(400).json({
      error: { code: "INVALID_COHORT_DATES", message: dateError },
    });
  }

  if (input.minimumStudents > input.capacity) {
    return res.status(400).json({
      error: {
        code: "INVALID_COHORT_CAPACITY",
        message: "Minimum students cannot exceed cohort capacity.",
      },
    });
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id: input.courseId },
      select: { id: true, isPublished: true },
    });

    if (!course) {
      return res.status(404).json({
        error: {
          code: "COURSE_NOT_FOUND",
          message: "The selected course does not exist.",
        },
      });
    }

    if (
      input.status === "OPEN" &&
      (!course.isPublished ||
        !isFutureStartDate(input.startDate) ||
        !isDeadlineOpen(input.enrollmentDeadline))
    ) {
      return res.status(400).json({
        error: {
          code: "COHORT_CANNOT_OPEN",
          message:
            "Publish the course and use a valid future start date and enrollment deadline before opening enrollment.",
        },
      });
    }

    const instructorCheck = await validateInstructor(input.instructorId);

    if (!instructorCheck.valid) {
      return res.status(400).json({
        error: {
          code: "INVALID_INSTRUCTOR",
          message: instructorCheck.message,
        },
      });
    }

    const cohort = await prisma.cohort.create({
      data: {
        ...input,
        startDate: toDateOnly(input.startDate),
        endDate: toDateOnly(input.endDate),
        enrollmentDeadline: input.enrollmentDeadline
          ? new Date(input.enrollmentDeadline)
          : null,
        instructorId: input.instructorId ?? null,
        priceXaf: input.priceXaf ?? null,
      },
      include: cohortInclude(),
    });

    return res.status(201).json({
      data: serializeCohort(cohort),
    });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin cohort creation");
  }
});

// PATCH /api/admin/cohorts/:id
router.patch("/:id", requireSameOrigin, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: {
        code: "INVALID_COHORT_ID",
        message: "Please provide a valid cohort ID.",
      },
    });
  }

  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  const input = parsed.data;

  try {
    const existing = await prisma.cohort.findUnique({
      where: { id },
      include: {
        enrollments: {
          where: { status: activeEnrollmentStatuses },
          select: { id: true },
        },
        course: {
          select: { isPublished: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: "COHORT_NOT_FOUND",
          message: "The requested cohort was not found.",
        },
      });
    }

    const startDate =
      input.startDate ?? existing.startDate.toISOString().slice(0, 10);
    const endDate =
      input.endDate ?? existing.endDate.toISOString().slice(0, 10);

    const enrollmentDeadline =
      input.enrollmentDeadline === undefined
        ? (existing.enrollmentDeadline?.toISOString() ?? null)
        : input.enrollmentDeadline;
    const capacity = input.capacity ?? existing.capacity;
    const minimumStudents = input.minimumStudents ?? existing.minimumStudents;
    const nextStatus = input.status ?? existing.status;
    const nextInstructorId =
      input.instructorId === undefined
        ? existing.instructorId
        : input.instructorId;

    if (nextStatus === "OPEN" && nextInstructorId == null) {
      return res.status(400).json({
        error: {
          code: "INSTRUCTOR_REQUIRED",
          message:
            "Assign an active instructor before opening cohort enrolment.",
        },
      });
    }

    const dateError = validateDates(startDate, endDate, enrollmentDeadline);

    if (dateError) {
      return res.status(400).json({
        error: { code: "INVALID_COHORT_DATES", message: dateError },
      });
    }

    if (minimumStudents > capacity) {
      return res.status(400).json({
        error: {
          code: "INVALID_COHORT_CAPACITY",
          message: "Minimum students cannot exceed cohort capacity.",
        },
      });
    }

    if (capacity < existing.enrollments.length) {
      return res.status(409).json({
        error: {
          code: "CAPACITY_BELOW_ENROLLMENTS",
          message:
            "Capacity cannot be lower than the number of active enrollments.",
        },
      });
    }

    if (existing.status === "CANCELLED" && nextStatus !== "CANCELLED") {
      return res.status(409).json({
        error: {
          code: "CANCELLED_COHORT_TERMINAL",
          message: "A cancelled cohort cannot be reopened or reactivated.",
        },
      });
    }

    if (existing.status === "COMPLETED" && nextStatus !== "COMPLETED") {
      return res.status(409).json({
        error: {
          code: "COMPLETED_COHORT_TERMINAL",
          message: "A completed cohort cannot be reactivated.",
        },
      });
    }

    if (nextStatus === "OPEN") {
      if (
        !existing.course.isPublished ||
        !isFutureStartDate(startDate) ||
        !isDeadlineOpen(enrollmentDeadline)
      ) {
        return res.status(400).json({
          error: {
            code: "COHORT_CANNOT_OPEN",
            message:
              "Publish the course and use a valid future start date and enrollment deadline before opening enrollment.",
          },
        });
      }

      if (capacity <= existing.enrollments.length) {
        return res.status(409).json({
          error: {
            code: "COHORT_FULL",
            message: "A full cohort cannot be opened for enrollment.",
          },
        });
      }
    }

    const instructorToValidate =
      input.instructorId !== undefined
        ? input.instructorId
        : existing.instructorId;

    if (instructorToValidate != null) {
      const instructorCheck = await validateInstructor(instructorToValidate);

      if (!instructorCheck.valid) {
        return res.status(400).json({
          error: {
            code: "INVALID_INSTRUCTOR",
            message: instructorCheck.message,
          },
        });
      }
    }

    const updateData = { ...input };

    if (input.startDate !== undefined) {
      updateData.startDate = toDateOnly(input.startDate);
    }

    if (input.endDate !== undefined) {
      updateData.endDate = toDateOnly(input.endDate);
    }

    if (input.enrollmentDeadline !== undefined) {
      updateData.enrollmentDeadline = input.enrollmentDeadline
        ? new Date(input.enrollmentDeadline)
        : null;
    }

    const cohort = await prisma.cohort.update({
      where: { id },
      data: updateData,
      include: cohortInclude(),
    });

    return res.status(200).json({
      data: serializeCohort(cohort),
    });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin cohort update");
  }
});

// No hard-delete endpoint: cancel cohorts to preserve enrollment history.

export default router;
