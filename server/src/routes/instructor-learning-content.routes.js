import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireInstructor);

const idSchema = z.coerce.number().int().positive();
const resourceTypes = [
  "PDF",
  "DOCUMENT",
  "VIDEO",
  "AUDIO",
  "LINK",
  "IMAGE",
  "OTHER",
];
const assessmentTypes = ["HOMEWORK", "QUIZ", "PRACTICE", "MOCK_EXAM"];
const questionTypes = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
];

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

function parseId(value) {
  const result = idSchema.safeParse(value);
  return result.success ? result.data : null;
}

const optionalText = (max) => z.string().trim().max(max).nullable().optional();

const resourceSchema = z
  .object({
    lessonId: z.number().int().positive(),
    title: z.string().trim().min(2).max(191),
    description: optionalText(10000),
    resourceType: z.enum(resourceTypes),
    url: z
      .string()
      .trim()
      .url()
      .max(2048)
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "URL must use HTTP or HTTPS."),
    releasePhase: z
      .enum(["PREPARATION", "AFTER_SESSION"])
      .default("AFTER_SESSION"),
    position: z.number().int().min(0).max(10000).default(0),
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
    description: optionalText(20000),
    assessmentType: z.enum(assessmentTypes),
    releasePhase: z
      .enum(["PREPARATION", "AFTER_SESSION"])
      .default("AFTER_SESSION"),
    instructions: optionalText(20000),
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
    questionType: z.enum(questionTypes),
    prompt: z.string().trim().min(2).max(20000),
    options: z.unknown().nullable().optional(),
    correctAnswer: z.unknown().nullable().optional(),
    explanation: optionalText(20000),
    points: z.number().int().positive().max(10000).default(1),
    position: z.number().int().min(1).max(10000),
  })
  .strict();

const questionUpdateSchema = questionSchema
  .omit({ assessmentId: true })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0);

const editableStatuses = ["DRAFT", "REJECTED"];

async function findOwnedLesson(lessonId, instructorId) {
  return prisma.lesson.findFirst({
    where: {
      id: lessonId,
      module: { course: { createdById: instructorId } },
    },
    select: {
      id: true,
      title: true,
      module: {
        select: {
          id: true,
          title: true,
          course: {
            select: { id: true, title: true, approvalStatus: true },
          },
        },
      },
    },
  });
}

function isEditable(lesson) {
  return editableStatuses.includes(lesson.module.course.approvalStatus);
}

async function requireEditableLesson(res, lessonId, instructorId) {
  const lesson = await findOwnedLesson(lessonId, instructorId);
  if (!lesson) {
    fail(
      res,
      404,
      "LESSON_NOT_FOUND",
      "The lesson was not found in your programs.",
    );
    return null;
  }
  if (!isEditable(lesson)) {
    fail(
      res,
      409,
      "PROGRAM_LOCKED",
      "This program is locked while awaiting review or after approval.",
    );
    return null;
  }
  return lesson;
}

async function findOwnedResource(id, instructorId) {
  return prisma.learningResource.findFirst({
    where: {
      id,
      lesson: { module: { course: { createdById: instructorId } } },
    },
    include: {
      lesson: {
        select: {
          id: true,
          module: { select: { course: { select: { approvalStatus: true } } } },
        },
      },
    },
  });
}

async function findOwnedAssessment(id, instructorId) {
  return prisma.assessment.findFirst({
    where: {
      id,
      lesson: { module: { course: { createdById: instructorId } } },
    },
    include: {
      lesson: {
        select: {
          id: true,
          module: { select: { course: { select: { approvalStatus: true } } } },
        },
      },
    },
  });
}

async function findOwnedQuestion(id, instructorId) {
  return prisma.assessmentQuestion.findFirst({
    where: {
      id,
      assessment: {
        lesson: { module: { course: { createdById: instructorId } } },
      },
    },
    include: {
      assessment: {
        select: {
          id: true,
          maxScore: true,
          lesson: {
            select: {
              id: true,
              module: {
                select: { course: { select: { approvalStatus: true } } },
              },
            },
          },
        },
      },
    },
  });
}

function checkQuestionAnswer(data) {
  const { questionType, options, correctAnswer } = data;
  const choices =
    Array.isArray(options) &&
    options.every((item) => typeof item === "string" && item.trim());

  if (["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)) {
    if (!choices || options.length < 2) {
      return "Choice questions require at least two text options.";
    }
    if (new Set(options).size !== options.length) {
      return "Choice options must be unique.";
    }
    if (questionType === "SINGLE_CHOICE") {
      if (
        typeof correctAnswer !== "string" ||
        !options.includes(correctAnswer)
      ) {
        return "The correct answer must match one of the options.";
      }
    } else if (
      !Array.isArray(correctAnswer) ||
      correctAnswer.length < 1 ||
      !correctAnswer.every(
        (answer) => typeof answer === "string" && options.includes(answer),
      )
    ) {
      return "Select one or more valid correct options.";
    }
  }

  if (questionType === "TRUE_FALSE" && typeof correctAnswer !== "boolean") {
    return "True/False questions require a boolean correct answer.";
  }

  if (
    questionType === "SHORT_ANSWER" &&
    !(typeof correctAnswer === "string" && correctAnswer.trim()) &&
    !(
      Array.isArray(correctAnswer) &&
      correctAnswer.length > 0 &&
      correctAnswer.every(
        (answer) => typeof answer === "string" && answer.trim(),
      )
    )
  ) {
    return "Short-answer questions require an expected answer.";
  }

  if (
    questionType === "LONG_ANSWER" &&
    correctAnswer !== undefined &&
    correctAnswer !== null
  ) {
    return "Long-answer questions must use explanation for marking guidance.";
  }

  return null;
}

async function questionPoints(assessmentId, excludeQuestionId = null) {
  const questions = await prisma.assessmentQuestion.findMany({
    where: {
      assessmentId,
      ...(excludeQuestionId ? { id: { not: excludeQuestionId } } : {}),
    },
    select: { points: true },
  });
  return questions.reduce((sum, question) => sum + question.points, 0);
}

function checkScoreRange(maxScore, passingScore) {
  return maxScore != null && passingScore != null && passingScore > maxScore;
}

// GET /api/instructor/learning-content/lessons/:lessonId
router.get("/lessons/:lessonId", async (req, res) => {
  const lessonId = parseId(req.params.lessonId);
  if (!lessonId) {
    return fail(res, 400, "INVALID_LESSON_ID", "Invalid lesson ID.");
  }

  try {
    const lesson = await findOwnedLesson(lessonId, req.instructor.id);
    if (!lesson) {
      return fail(
        res,
        404,
        "LESSON_NOT_FOUND",
        "The lesson was not found in your programs.",
      );
    }

    const [resources, assessments] = await Promise.all([
      prisma.learningResource.findMany({
        where: { lessonId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      }),
      prisma.assessment.findMany({
        where: { lessonId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          questions: { orderBy: [{ position: "asc" }, { id: "asc" }] },
          _count: { select: { attempts: true } },
        },
      }),
    ]);

    return res.json({
      data: {
        lesson,
        resources,
        assessments,
        canEdit: isEditable(lesson),
      },
    });
  } catch (error) {
    return handleError(res, error, "Instructor learning content listing");
  }
});

// RESOURCES

router.post("/resources", requireSameOrigin, async (req, res) => {
  const parsed = resourceSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const lesson = await requireEditableLesson(
      res,
      parsed.data.lessonId,
      req.instructor.id,
    );
    if (!lesson) return;

    const data = await prisma.learningResource.create({
      data: { ...parsed.data, isPublished: false },
    });
    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor resource creation");
  }
});

router.patch("/resources/:id", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "INVALID_RESOURCE_ID", "Invalid resource ID.");

  const parsed = resourceUpdateSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const existing = await findOwnedResource(id, req.instructor.id);
    if (!existing)
      return fail(res, 404, "RESOURCE_NOT_FOUND", "Resource not found.");
    if (
      !editableStatuses.includes(existing.lesson.module.course.approvalStatus)
    ) {
      return fail(res, 409, "PROGRAM_LOCKED", "This program is not editable.");
    }

    const data = await prisma.learningResource.update({
      where: { id },
      data: parsed.data,
    });
    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor resource update");
  }
});

// ASSESSMENTS

router.post("/assessments", requireSameOrigin, async (req, res) => {
  const parsed = assessmentSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const input = parsed.data;
  if (checkScoreRange(input.maxScore, input.passingScore)) {
    return fail(
      res,
      400,
      "INVALID_SCORE_RANGE",
      "Passing score cannot exceed maximum score.",
    );
  }

  try {
    const lesson = await requireEditableLesson(
      res,
      input.lessonId,
      req.instructor.id,
    );
    if (!lesson) return;

    const data = await prisma.assessment.create({
      data: {
        ...input,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        isPublished: false,
      },
    });
    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor assessment creation");
  }
});

router.patch("/assessments/:id", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id)
    return fail(res, 400, "INVALID_ASSESSMENT_ID", "Invalid assessment ID.");

  const parsed = assessmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const existing = await findOwnedAssessment(id, req.instructor.id);
    if (!existing)
      return fail(res, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");
    if (
      !editableStatuses.includes(existing.lesson.module.course.approvalStatus)
    ) {
      return fail(res, 409, "PROGRAM_LOCKED", "This program is not editable.");
    }

    const maxScore =
      parsed.data.maxScore === undefined
        ? existing.maxScore
        : parsed.data.maxScore;
    const passingScore =
      parsed.data.passingScore === undefined
        ? existing.passingScore
        : parsed.data.passingScore;

    if (checkScoreRange(maxScore, passingScore)) {
      return fail(
        res,
        400,
        "INVALID_SCORE_RANGE",
        "Passing score cannot exceed maximum score.",
      );
    }

    const totalPoints = await questionPoints(id);
    if (maxScore != null && totalPoints > maxScore) {
      return fail(
        res,
        400,
        "QUESTION_POINTS_EXCEED_MAX_SCORE",
        "Maximum score cannot be lower than the total points assigned to questions.",
      );
    }

    const updateData = { ...parsed.data };
    if (parsed.data.dueAt !== undefined) {
      updateData.dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    }

    const data = await prisma.assessment.update({
      where: { id },
      data: updateData,
    });
    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor assessment update");
  }
});

// QUESTIONS

router.post("/questions", requireSameOrigin, async (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const input = parsed.data;
  const answerError = checkQuestionAnswer(input);
  if (answerError)
    return fail(res, 400, "INVALID_QUESTION_ANSWERS", answerError);

  try {
    const assessment = await findOwnedAssessment(
      input.assessmentId,
      req.instructor.id,
    );
    if (!assessment) {
      return fail(res, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");
    }
    if (
      !editableStatuses.includes(assessment.lesson.module.course.approvalStatus)
    ) {
      return fail(res, 409, "PROGRAM_LOCKED", "This program is not editable.");
    }

    const total = await questionPoints(input.assessmentId);
    if (
      assessment.maxScore != null &&
      total + input.points > assessment.maxScore
    ) {
      return fail(
        res,
        400,
        "QUESTION_POINTS_EXCEED_MAX_SCORE",
        "Question points cannot exceed the assessment maximum score.",
      );
    }

    const data = await prisma.assessmentQuestion.create({ data: input });
    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor question creation");
  }
});

router.patch("/questions/:id", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "INVALID_QUESTION_ID", "Invalid question ID.");

  const parsed = questionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const existing = await findOwnedQuestion(id, req.instructor.id);
    if (!existing)
      return fail(res, 404, "QUESTION_NOT_FOUND", "Question not found.");
    if (
      !editableStatuses.includes(
        existing.assessment.lesson.module.course.approvalStatus,
      )
    ) {
      return fail(res, 409, "PROGRAM_LOCKED", "This program is not editable.");
    }

    const merged = {
      questionType: parsed.data.questionType ?? existing.questionType,
      options:
        parsed.data.options === undefined
          ? existing.options
          : parsed.data.options,
      correctAnswer:
        parsed.data.correctAnswer === undefined
          ? existing.correctAnswer
          : parsed.data.correctAnswer,
    };
    const answerError = checkQuestionAnswer(merged);
    if (answerError) {
      return fail(res, 400, "INVALID_QUESTION_ANSWERS", answerError);
    }

    const points = parsed.data.points ?? existing.points;
    const total = await questionPoints(existing.assessmentId, id);
    if (
      existing.assessment.maxScore != null &&
      total + points > existing.assessment.maxScore
    ) {
      return fail(
        res,
        400,
        "QUESTION_POINTS_EXCEED_MAX_SCORE",
        "Question points cannot exceed the assessment maximum score.",
      );
    }

    const data = await prisma.assessmentQuestion.update({
      where: { id },
      data: parsed.data,
    });
    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor question update");
  }
});

export default router;
