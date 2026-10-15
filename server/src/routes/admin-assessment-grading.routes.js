import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireAdmin);

function fail(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const gradeSchema = z
  .object({
    questionScores: z
      .array(
        z
          .object({
            questionId: z.number().int().positive(),
            pointsAwarded: z.number().finite().min(0),
          })
          .strict(),
      )
      .optional(),
    score: z.number().finite().min(0).optional(),
    feedback: z.string().trim().max(10000).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => data.questionScores !== undefined || data.score !== undefined,
    "Provide question scores or a final score.",
  );

const attemptInclude = {
  assessment: {
    include: {
      lesson: {
        include: {
          module: {
            include: {
              course: {
                select: { id: true, title: true },
              },
            },
          },
        },
      },
      questions: {
        orderBy: { position: "asc" },
      },
    },
  },
  enrollment: {
    include: {
      user: {
        select: { id: true, fullName: true, email: true },
      },
      cohort: {
        select: { id: true, name: true },
      },
    },
  },
};

// List submitted assessments awaiting grading.
router.get("/queue", async (_req, res) => {
  try {
    const attempts = await prisma.assessmentAttempt.findMany({
      where: { status: "SUBMITTED" },
      include: attemptInclude,
      orderBy: { submittedAt: "asc" },
    });

    const data = attempts.map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
      startedAt: attempt.startedAt,
      assessment: {
        id: attempt.assessment.id,
        title: attempt.assessment.title,
        type: attempt.assessment.assessmentType,
        maxScore: attempt.assessment.maxScore,
        course: attempt.assessment.lesson.module.course.title,
        lesson: attempt.assessment.lesson.title,
      },
      student: attempt.enrollment.user
        ? {
            id: attempt.enrollment.user.id,
            fullName: attempt.enrollment.user.fullName,
            email: attempt.enrollment.user.email,
          }
        : {
            fullName: "Guest student",
            email: null,
          },
      cohort: attempt.enrollment.cohort,
    }));

    return res.json({ data, count: data.length });
  } catch (error) {
    console.error("Grading queue failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load the grading queue.",
    );
  }
});

// Load a submitted attempt with its questions and submitted answers.
router.get("/attempts/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_ID", "Invalid attempt ID.");
  }

  try {
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id },
      include: attemptInclude,
    });

    if (!attempt) {
      return fail(res, 404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
    }

    const answers =
      attempt.answers &&
      typeof attempt.answers === "object" &&
      !Array.isArray(attempt.answers)
        ? attempt.answers
        : {};

    return res.json({
      data: {
        id: attempt.id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
        answers,
        score: attempt.score,
        feedback: attempt.feedback,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        assessment: {
          id: attempt.assessment.id,
          title: attempt.assessment.title,
          maxScore: attempt.assessment.maxScore,
          passingScore: attempt.assessment.passingScore,
          questions: attempt.assessment.questions.map((question) => ({
            id: question.id,
            prompt: question.prompt,
            questionType: question.questionType,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            points: question.points,
            position: question.position,
          })),
        },
        student: attempt.enrollment.user
          ? {
              id: attempt.enrollment.user.id,
              fullName: attempt.enrollment.user.fullName,
              email: attempt.enrollment.user.email,
            }
          : {
              fullName: "Guest student",
              email: null,
            },
        cohort: attempt.enrollment.cohort,
      },
    });
  } catch (error) {
    console.error("Loading grading attempt failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load this attempt.",
    );
  }
});

// Grade an attempt and publish the result.
router.patch("/attempts/:id/grade", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = gradeSchema.safeParse(req.body);

  if (!id) {
    return fail(res, 400, "INVALID_ID", "Invalid attempt ID.");
  }

  if (!parsed.success) {
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "Provide valid grading information.",
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findUnique({
        where: { id },
        include: {
          assessment: {
            include: {
              questions: true,
            },
          },
        },
      });

      if (!attempt) return { error: "NOT_FOUND" };

      if (attempt.status !== "SUBMITTED") {
        return { error: "NOT_SUBMITTED" };
      }

      const questions = attempt.assessment.questions;
      const questionById = new Map(
        questions.map((question) => [question.id, question]),
      );

      let finalScore;

      if (parsed.data.questionScores !== undefined) {
        const scores = parsed.data.questionScores;
        const seen = new Set();

        for (const item of scores) {
          if (seen.has(item.questionId)) {
            return { error: "DUPLICATE_QUESTION" };
          }

          seen.add(item.questionId);

          const question = questionById.get(item.questionId);

          if (!question) {
            return { error: "INVALID_QUESTION" };
          }

          if (item.pointsAwarded > question.points) {
            return { error: "SCORE_EXCEEDS_POINTS" };
          }
        }

        // Require an explicit score for every question.
        if (
          scores.length !== questions.length ||
          questions.some((question) => !seen.has(question.id))
        ) {
          return { error: "INCOMPLETE_GRADING" };
        }

        finalScore = scores.reduce((sum, item) => sum + item.pointsAwarded, 0);

        if (
          parsed.data.score !== undefined &&
          Math.abs(parsed.data.score - finalScore) > 0.001
        ) {
          return { error: "SCORE_MISMATCH" };
        }
      } else {
        finalScore = parsed.data.score;
      }

      if (
        attempt.assessment.maxScore !== null &&
        finalScore > attempt.assessment.maxScore
      ) {
        return { error: "SCORE_EXCEEDS_MAX" };
      }

      const updated = await tx.assessmentAttempt.update({
        where: { id },
        data: {
          score: new Prisma.Decimal(finalScore.toFixed(2)),
          feedback: parsed.data.feedback,
          status: "GRADED",
          gradedAt: new Date(),
          gradedById: req.admin.id,
        },
      });

      return { attempt: updated };
    });

    const messages = {
      NOT_FOUND: [404, "ATTEMPT_NOT_FOUND", "Attempt not found."],
      NOT_SUBMITTED: [
        409,
        "ATTEMPT_NOT_READY",
        "Only submitted attempts can be graded.",
      ],
      DUPLICATE_QUESTION: [
        400,
        "DUPLICATE_QUESTION",
        "A question was graded more than once.",
      ],
      INVALID_QUESTION: [
        400,
        "INVALID_QUESTION",
        "A score refers to an unknown question.",
      ],
      SCORE_EXCEEDS_POINTS: [
        400,
        "SCORE_TOO_HIGH",
        "A question score exceeds its maximum points.",
      ],
      INCOMPLETE_GRADING: [
        400,
        "INCOMPLETE_GRADING",
        "Provide a score for every question.",
      ],
      SCORE_MISMATCH: [
        400,
        "SCORE_MISMATCH",
        "The final score does not match the question scores.",
      ],
      SCORE_EXCEEDS_MAX: [
        400,
        "SCORE_TOO_HIGH",
        "The score exceeds the assessment maximum.",
      ],
    };

    if (result.error) {
      const [status, code, message] = messages[result.error];
      return fail(res, status, code, message);
    }

    return res.json({
      data: {
        id: result.attempt.id,
        status: result.attempt.status,
        score: result.attempt.score,
        feedback: result.attempt.feedback,
        gradedAt: result.attempt.gradedAt,
      },
    });
  } catch (error) {
    console.error("Grading attempt failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to grade this attempt.",
    );
  }
});

export default router;
