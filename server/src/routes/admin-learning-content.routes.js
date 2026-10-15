import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

const idSchema = z.coerce.number().int().positive();

const resourceSchema = z
  .object({
    lessonId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: z.string().trim().max(10000).nullable().optional(),
    resourceType: z.enum([
      "PDF",
      "DOCUMENT",
      "VIDEO",
      "AUDIO",
      "LINK",
      "IMAGE",
      "OTHER",
    ]),
    url: z.string().trim().url().max(2048),
    releasePhase: z
      .enum(["PREPARATION", "AFTER_SESSION"])
      .optional()
      .default("AFTER_SESSION"),
    position: z.number().int().min(0).max(10000).optional().default(0),
    isPublished: z.boolean().optional().default(false),
  })
  .strict();

const resourceUpdateSchema = resourceSchema
  .omit({ lessonId: true })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0);

const assessmentSchema = z
  .object({
    lessonId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: z.string().trim().max(20000).nullable().optional(),
    assessmentType: z.enum(["HOMEWORK", "QUIZ", "PRACTICE", "MOCK_EXAM"]),
    releasePhase: z
      .enum(["PREPARATION", "AFTER_SESSION"])
      .optional()
      .default("AFTER_SESSION"),
    instructions: z.string().trim().max(20000).nullable().optional(),
    maxScore: z.number().int().positive().nullable().optional(),
    passingScore: z.number().int().min(0).nullable().optional(),
    timeLimitMinutes: z
      .number()
      .int()
      .positive()
      .max(1440)
      .nullable()
      .optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
    isPublished: z.boolean().optional().default(false),
  })
  .strict();

const assessmentUpdateSchema = assessmentSchema
  .omit({ lessonId: true })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0);

const questionSchema = z
  .object({
    assessmentId: z.number().int().positive(),
    questionType: z.enum([
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "SHORT_ANSWER",
      "LONG_ANSWER",
    ]),
    prompt: z.string().trim().min(2).max(20000),
    options: z.unknown().nullable().optional(),
    correctAnswer: z.unknown().nullable().optional(),
    explanation: z.string().trim().max(20000).nullable().optional(),
    points: z.number().int().positive().max(10000).optional().default(1),
    position: z.number().int().min(1).max(10000),
  })
  .strict();

const questionUpdateSchema = questionSchema
  .omit({ assessmentId: true })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0);

function parseId(value) {
  const result = idSchema.safeParse(value);
  return result.success ? result.data : null;
}

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
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

// -----------------------------------------------------------------------------
// RESOURCES
// -----------------------------------------------------------------------------

// GET /api/admin/learning-content/resources?lessonId=1
router.get("/resources", requireAdmin, async (req, res) => {
  const lessonId = parseId(req.query.lessonId);
  if (!lessonId) {
    return fail(
      res,
      400,
      "INVALID_LESSON_ID",
      "Provide a valid lessonId query parameter.",
    );
  }

  try {
    const data = await prisma.learningResource.findMany({
      where: { lessonId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });

    return res.json({ data, count: data.length });
  } catch (error) {
    return handleError(res, error, "Admin resource listing");
  }
});

// POST /api/admin/learning-content/resources
router.post("/resources", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = resourceSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: parsed.data.lessonId },
      select: { id: true },
    });

    if (!lesson) return fail(res, 404, "LESSON_NOT_FOUND", "Lesson not found.");

    const data = await prisma.learningResource.create({ data: parsed.data });
    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Admin resource creation");
  }
});

// PATCH /api/admin/learning-content/resources/:id
router.patch(
  "/resources/:id",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
      return fail(
        res,
        400,
        "INVALID_RESOURCE_ID",
        "Provide a valid resource ID.",
      );

    const parsed = resourceUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    try {
      const existing = await prisma.learningResource.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing)
        return fail(res, 404, "RESOURCE_NOT_FOUND", "Resource not found.");

      const data = await prisma.learningResource.update({
        where: { id },
        data: parsed.data,
      });

      return res.json({ data });
    } catch (error) {
      return handleError(res, error, "Admin resource update");
    }
  },
);

// -----------------------------------------------------------------------------
// ASSESSMENTS
// -----------------------------------------------------------------------------

// GET /api/admin/learning-content/assessments?lessonId=1
router.get("/assessments", requireAdmin, async (req, res) => {
  const lessonId = parseId(req.query.lessonId);
  if (!lessonId) {
    return fail(
      res,
      400,
      "INVALID_LESSON_ID",
      "Provide a valid lessonId query parameter.",
    );
  }

  try {
    const data = await prisma.assessment.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
      include: {
        questions: { orderBy: { position: "asc" } },
        _count: { select: { attempts: true } },
      },
    });

    return res.json({ data, count: data.length });
  } catch (error) {
    return handleError(res, error, "Admin assessment listing");
  }
});

// POST /api/admin/learning-content/assessments
router.post(
  "/assessments",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const parsed = assessmentSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const input = parsed.data;

    if (
      input.maxScore != null &&
      input.passingScore != null &&
      input.passingScore > input.maxScore
    ) {
      return fail(
        res,
        400,
        "INVALID_SCORE_RANGE",
        "Passing score cannot exceed maximum score.",
      );
    }

    try {
      const lesson = await prisma.lesson.findUnique({
        where: { id: input.lessonId },
        select: { id: true },
      });

      if (!lesson)
        return fail(res, 404, "LESSON_NOT_FOUND", "Lesson not found.");

      const data = await prisma.assessment.create({
        data: {
          ...input,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
        },
      });

      return res.status(201).json({ data });
    } catch (error) {
      return handleError(res, error, "Admin assessment creation");
    }
  },
);

// PATCH /api/admin/learning-content/assessments/:id
router.patch(
  "/assessments/:id",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
      return fail(
        res,
        400,
        "INVALID_ASSESSMENT_ID",
        "Provide a valid assessment ID.",
      );

    const parsed = assessmentUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    try {
      const existing = await prisma.assessment.findUnique({
        where: { id },
        select: { id: true, maxScore: true, passingScore: true },
      });

      if (!existing)
        return fail(res, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");

      const maxScore =
        parsed.data.maxScore === undefined
          ? existing.maxScore
          : parsed.data.maxScore;

      const passingScore =
        parsed.data.passingScore === undefined
          ? existing.passingScore
          : parsed.data.passingScore;

      if (maxScore != null && passingScore != null && passingScore > maxScore) {
        return fail(
          res,
          400,
          "INVALID_SCORE_RANGE",
          "Passing score cannot exceed maximum score.",
        );
      }

      const updateData = { ...parsed.data };
      if (parsed.data.dueAt !== undefined) {
        updateData.dueAt = parsed.data.dueAt
          ? new Date(parsed.data.dueAt)
          : null;
      }

      const data = await prisma.assessment.update({
        where: { id },
        data: updateData,
      });

      return res.json({ data });
    } catch (error) {
      return handleError(res, error, "Admin assessment update");
    }
  },
);

// -----------------------------------------------------------------------------
// QUESTIONS
// -----------------------------------------------------------------------------

// GET /api/admin/learning-content/assessments/:assessmentId/questions
router.get(
  "/assessments/:assessmentId/questions",
  requireAdmin,
  async (req, res) => {
    const assessmentId = parseId(req.params.assessmentId);
    if (!assessmentId) {
      return fail(
        res,
        400,
        "INVALID_ASSESSMENT_ID",
        "Provide a valid assessment ID.",
      );
    }

    try {
      const data = await prisma.assessmentQuestion.findMany({
        where: { assessmentId },
        orderBy: { position: "asc" },
      });

      return res.json({ data, count: data.length });
    } catch (error) {
      return handleError(res, error, "Admin question listing");
    }
  },
);

// POST /api/admin/learning-content/questions
router.post("/questions", requireSameOrigin, requireAdmin, async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: parsed.data.assessmentId },
      select: { id: true, maxScore: true },
    });

    if (!assessment)
      return fail(res, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");

    const data = await prisma.assessmentQuestion.create({ data: parsed.data });
    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Admin question creation");
  }
});

// PATCH /api/admin/learning-content/questions/:id
router.patch(
  "/questions/:id",
  requireSameOrigin,
  requireAdmin,
  async (req, res) => {
    const id = parseId(req.params.id);
    if (!id)
      return fail(
        res,
        400,
        "INVALID_QUESTION_ID",
        "Provide a valid question ID.",
      );

    const parsed = questionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    try {
      const existing = await prisma.assessmentQuestion.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing)
        return fail(res, 404, "QUESTION_NOT_FOUND", "Question not found.");

      const data = await prisma.assessmentQuestion.update({
        where: { id },
        data: parsed.data,
      });

      return res.json({ data });
    } catch (error) {
      return handleError(res, error, "Admin question update");
    }
  },
);

export default router;
