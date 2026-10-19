import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireInstructor);

const idSchema = z.coerce.number().int().positive();

const moduleCreateSchema = z
  .object({
    courseId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: z.string().trim().max(20000).nullable().optional(),
    position: z.number().int().min(1).max(1000),
  })
  .strict();

const moduleUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(191).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    position: z.number().int().min(1).max(1000).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

const lessonCreateSchema = z
  .object({
    moduleId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: z.string().trim().max(20000).nullable().optional(),
    objectives: z.string().trim().max(20000).nullable().optional(),
    preparationContent: z.string().max(50000).nullable().optional(),
    content: z.string().max(100000).nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    position: z.number().int().min(1).max(1000),
  })
  .strict();

const lessonUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(191).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    objectives: z.string().trim().max(20000).nullable().optional(),
    preparationContent: z.string().max(50000).nullable().optional(),
    content: z.string().max(100000).nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
    position: z.number().int().min(1).max(1000).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

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

function handleError(res, error, operation) {
  if (error?.code === "P2002") {
    return fail(
      res,
      409,
      "DUPLICATE_POSITION",
      "Another item already uses this position.",
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

function parseId(value) {
  const result = idSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Instructors may edit content only while their own program
 * is a draft or has been rejected for revision.
 */
async function findEditableCourse(courseId, instructorId) {
  return prisma.course.findFirst({
    where: {
      id: courseId,
      createdById: instructorId,
      approvalStatus: { in: ["DRAFT", "REJECTED"] },
    },
    select: { id: true },
  });
}

async function findEditableModule(moduleId, instructorId) {
  return prisma.courseModule.findFirst({
    where: {
      id: moduleId,
      course: {
        createdById: instructorId,
        approvalStatus: { in: ["DRAFT", "REJECTED"] },
      },
    },
    select: { id: true, courseId: true },
  });
}

async function findEditableLesson(lessonId, instructorId) {
  return prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: {
        course: {
          createdById: instructorId,
          approvalStatus: { in: ["DRAFT", "REJECTED"] },
        },
      },
    },
    select: {
      id: true,
      moduleId: true,
      module: { select: { courseId: true } },
    },
  });
}

// GET /api/instructor/pedagogy/modules?courseId=1
router.get("/modules", async (req, res) => {
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
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        createdById: req.instructor.id,
      },
      select: {
        id: true,
        title: true,
        approvalStatus: true,
        isPublished: true,
      },
    });

    if (!course) {
      return fail(res, 404, "PROGRAM_NOT_FOUND", "Program not found.");
    }

    const data = await prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { position: "asc" },
      include: {
        lessons: {
          orderBy: { position: "asc" },
          include: {
            _count: {
              select: { resources: true, assessments: true },
            },
          },
        },
      },
    });

    return res.json({
      data,
      count: data.length,
      course,
      canEdit: ["DRAFT", "REJECTED"].includes(course.approvalStatus),
    });
  } catch (error) {
    return handleError(res, error, "Instructor module listing");
  }
});

// POST /api/instructor/pedagogy/modules
router.post("/modules", requireSameOrigin, async (req, res) => {
  const parsed = moduleCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const course = await findEditableCourse(
      parsed.data.courseId,
      req.instructor.id,
    );

    if (!course) {
      return fail(
        res,
        404,
        "EDITABLE_PROGRAM_NOT_FOUND",
        "The program was not found or is not editable.",
      );
    }

    const data = await prisma.courseModule.create({
      data: {
        ...parsed.data,
        isPublished: false,
      },
    });

    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor module creation");
  }
});

// PATCH /api/instructor/pedagogy/modules/:id
router.patch("/modules/:id", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_MODULE_ID", "Invalid module ID.");
  }

  const parsed = moduleUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const existing = await findEditableModule(id, req.instructor.id);

    if (!existing) {
      return fail(
        res,
        404,
        "EDITABLE_MODULE_NOT_FOUND",
        "The module was not found or is not editable.",
      );
    }

    const data = await prisma.courseModule.update({
      where: { id },
      data: parsed.data,
    });

    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor module update");
  }
});

// GET /api/instructor/pedagogy/lessons/:id
router.get("/lessons/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_LESSON_ID", "Invalid lesson ID.");
  }

  try {
    const lesson = await prisma.lesson.findFirst({
      where: {
        id,
        module: {
          course: { createdById: req.instructor.id },
        },
      },
      include: {
        _count: {
          select: { resources: true, assessments: true },
        },
      },
    });

    if (!lesson) {
      return fail(res, 404, "LESSON_NOT_FOUND", "Lesson not found.");
    }

    return res.json({ data: lesson });
  } catch (error) {
    return handleError(res, error, "Instructor lesson details");
  }
});

// POST /api/instructor/pedagogy/lessons
router.post("/lessons", requireSameOrigin, async (req, res) => {
  const parsed = lessonCreateSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const module = await findEditableModule(
      parsed.data.moduleId,
      req.instructor.id,
    );

    if (!module) {
      return fail(
        res,
        404,
        "EDITABLE_MODULE_NOT_FOUND",
        "The module was not found or is not editable.",
      );
    }

    const data = await prisma.lesson.create({
      data: {
        ...parsed.data,
        isPublished: false,
      },
    });

    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor lesson creation");
  }
});

// PATCH /api/instructor/pedagogy/lessons/:id
router.patch("/lessons/:id", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_LESSON_ID", "Invalid lesson ID.");
  }

  const parsed = lessonUpdateSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const existing = await findEditableLesson(id, req.instructor.id);

    if (!existing) {
      return fail(
        res,
        404,
        "EDITABLE_LESSON_NOT_FOUND",
        "The lesson was not found or is not editable.",
      );
    }

    const data = await prisma.lesson.update({
      where: { id },
      data: parsed.data,
    });

    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor lesson update");
  }
});

export default router;
