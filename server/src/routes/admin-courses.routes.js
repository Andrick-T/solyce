import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const courseFields = {
  slug: slugSchema,
  title: z.string().trim().min(3).max(191),
  description: z.string().trim().min(10).max(20000),
  language: z.enum(["ENGLISH", "FRENCH"]),
  examType: z.string().trim().min(1).max(50),
  durationWeeks: z.number().int().min(1).max(104),
  curriculum: z.string().max(30000).nullable().optional(),
  priceXaf: z.number().int().min(0).max(100000000),
  isPublished: z.boolean(),
};

const createCourseSchema = z
  .object({
    ...courseFields,
    curriculum: courseFields.curriculum,
    isPublished: z.boolean().optional().default(false),
  })
  .strict();

const updateCourseSchema = z
  .object(courseFields)
  .partial()
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
      message: "Please review the submitted course information.",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    },
  });
}

function handleDatabaseError(res, error, operation) {
  if (error.code === "P2002") {
    return res.status(409).json({
      error: {
        code: "DUPLICATE_COURSE_SLUG",
        message: "A course with this slug already exists.",
      },
    });
  }

  console.error(`${operation} failed:`, error.message);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to complete this course operation.",
    },
  });
}

// GET /api/admin/courses
// List all courses, including unpublished courses.
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { cohorts: true },
        },
      },
    });

    return res.status(200).json({
      data: courses,
      count: courses.length,
    });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin course listing");
  }
});

// GET /api/admin/courses/:id
router.get("/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: {
        code: "INVALID_COURSE_ID",
        message: "Please provide a valid course ID.",
      },
    });
  }

  try {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        cohorts: {
          orderBy: { startDate: "desc" },
          include: {
            _count: {
              select: { enrollments: true },
            },
          },
        },
        _count: {
          select: { cohorts: true },
        },
      },
    });

    if (!course) {
      return res.status(404).json({
        error: {
          code: "COURSE_NOT_FOUND",
          message: "The requested course was not found.",
        },
      });
    }

    return res.status(200).json({ data: course });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin course details");
  }
});

// POST /api/admin/courses
router.post("/", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = createCourseSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const course = await prisma.course.create({
      data: parsed.data,
    });

    return res.status(201).json({ data: course });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin course creation");
  }
});

// PATCH /api/admin/courses/:id
router.patch("/:id", requireSameOrigin, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: {
        code: "INVALID_COURSE_ID",
        message: "Please provide a valid course ID.",
      },
    });
  }

  const parsed = updateCourseSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const existingCourse = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        approvalStatus: true,
      },
    });

    if (!existingCourse) {
      return res.status(404).json({
        error: {
          code: "COURSE_NOT_FOUND",
          message: "The requested course was not found.",
        },
      });
    }
    if (
      parsed.data.isPublished === true &&
      existingCourse.approvalStatus !== "APPROVED"
    ) {
      return res.status(409).json({
        error: {
          code: "COURSE_NOT_APPROVED",
          message: "Only approved courses can be published.",
        },
      });
    }
    const course = await prisma.course.update({
      where: { id },
      data: parsed.data,
    });

    return res.status(200).json({ data: course });
  } catch (error) {
    return handleDatabaseError(res, error, "Admin course update");
  }
});

// DELETE is intentionally not provided.
// Unpublish a course with PATCH { "isPublished": false } instead.

const approvalSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
  })
  .strict();

// PATCH /api/admin/courses/:id/approval
router.patch(
  "/:id/approval",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        error: {
          code: "INVALID_COURSE_ID",
          message: "Please provide a valid course ID.",
        },
      });
    }

    const parsed = approvalSchema.safeParse(req.body);

    if (!parsed.success) {
      return validationError(res, parsed.error);
    }

    try {
      const result = await prisma.course.updateMany({
        where: {
          id,
          approvalStatus: "PENDING_REVIEW",
        },
        data: {
          approvalStatus: parsed.data.status,
          ...(parsed.data.status === "REJECTED" ? { isPublished: false } : {}),
        },
      });

      if (result.count === 0) {
        const existingCourse = await prisma.course.findUnique({
          where: { id },
          select: {
            id: true,
            approvalStatus: true,
          },
        });

        if (!existingCourse) {
          return res.status(404).json({
            error: {
              code: "COURSE_NOT_FOUND",
              message: "The requested course was not found.",
            },
          });
        }

        return res.status(409).json({
          error: {
            code: "INVALID_APPROVAL_TRANSITION",
            message:
              "Only programs pending review can be approved or rejected.",
          },
        });
      }

      const course = await prisma.course.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          approvalStatus: true,
          isPublished: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({ data: course });
    } catch (error) {
      return handleDatabaseError(res, error, "Admin course approval");
    }
  },
);

export default router;
