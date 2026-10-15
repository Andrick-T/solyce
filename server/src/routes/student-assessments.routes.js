import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../db/prisma.js";
import { requireStudent } from "../middleware/require-student.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireStudent);

function fail(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function isReleased(assessment, sessions, now = new Date()) {
  return sessions.some((session) => {
    if (session.status === "CANCELLED") return false;

    if (assessment.releasePhase === "PREPARATION") {
      const releaseAt = new Date(
        session.scheduledAt.getTime() - session.preparationLeadMinutes * 60_000,
      );

      return now >= releaseAt;
    }

    return now >= session.scheduledEndAt;
  });
}

async function getAssessmentAccess(assessmentId, studentId) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      isPublished: true,
      lesson: {
        isPublished: true,
        module: {
          isPublished: true,
          course: { isPublished: true },
        },
      },
    },
    include: {
      questions: {
        orderBy: { position: "asc" },
      },
      lesson: {
        include: {
          module: {
            select: { courseId: true },
          },
        },
      },
    },
  });

  if (!assessment) {
    return { error: "NOT_FOUND" };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: studentId,
      status: "CONFIRMED",
      cohort: {
        status: { not: "CANCELLED" },
        courseId: assessment.lesson.module.courseId,
      },
    },
    include: {
      cohort: {
        include: {
          scheduledLessons: {
            where: {
              lessonId: assessment.lessonId,
            },
          },
        },
      },
    },
  });

  const accessibleEnrollments = enrollments.filter((enrollment) =>
    isReleased(assessment, enrollment.cohort.scheduledLessons),
  );

  if (accessibleEnrollments.length === 0) {
    return { error: "NOT_AVAILABLE" };
  }

  return {
    assessment,
    enrollmentIds: accessibleEnrollments.map((enrollment) => enrollment.id),
  };
}

function safeQuestion(question) {
  return {
    id: question.id,
    questionType: question.questionType,
    prompt: question.prompt,
    options: question.options,
    points: question.points,
    position: question.position,
  };
}

function safeAttempt(attempt) {
  return {
    id: attempt.id,
    assessmentId: attempt.assessmentId,
    attemptNumber: attempt.attemptNumber,
    answers: attempt.answers,
    score: attempt.status === "GRADED" ? attempt.score : null,
    feedback: attempt.status === "GRADED" ? attempt.feedback : null,
    status: attempt.status,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    gradedAt: attempt.gradedAt,
  };
}

function isAttemptExpired(attempt, now = new Date()) {
  const timeLimitMinutes = attempt.assessment?.timeLimitMinutes;

  // No time limit configured: the attempt does not expire by duration.
  if (
    timeLimitMinutes === null ||
    timeLimitMinutes === undefined ||
    timeLimitMinutes <= 0
  ) {
    return false;
  }

  const deadline =
    new Date(attempt.startedAt).getTime() + timeLimitMinutes * 60_000;

  return now.getTime() >= deadline;
}

const answerSchema = z
  .record(z.string(), z.unknown())
  .refine((answers) => Object.keys(answers).length <= 200, "Too many answers.");

function normalizeAnswer(value) {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  return value;
}

function answersMatch(question, submittedAnswer) {
  const expected = question.correctAnswer;

  if (expected === null || expected === undefined) {
    return null;
  }

  if (question.questionType === "LONG_ANSWER") {
    return null;
  }

  if (question.questionType === "SHORT_ANSWER") {
    return null;
  }

  if (question.questionType === "MULTIPLE_CHOICE") {
    if (!Array.isArray(expected) || !Array.isArray(submittedAnswer)) {
      return false;
    }

    const actual = submittedAnswer.map(normalizeAnswer).sort();

    const correct = expected.map(normalizeAnswer).sort();

    return JSON.stringify(actual) === JSON.stringify(correct);
  }

  if (question.questionType === "TRUE_FALSE") {
    const actual =
      typeof submittedAnswer === "string"
        ? submittedAnswer.trim().toLowerCase()
        : submittedAnswer;

    const correct =
      typeof expected === "string" ? expected.trim().toLowerCase() : expected;

    return actual === correct;
  }

  return (
    JSON.stringify(normalizeAnswer(submittedAnswer)) ===
    JSON.stringify(normalizeAnswer(expected))
  );
}

// Start a new attempt.
router.post(
  "/assessments/:assessmentId/attempts",
  requireSameOrigin,
  async (req, res) => {
    const assessmentId = Number(req.params.assessmentId);

    if (!Number.isSafeInteger(assessmentId) || assessmentId < 1) {
      return fail(res, 400, "INVALID_ID", "Invalid assessment ID.");
    }

    try {
      const access = await getAssessmentAccess(assessmentId, req.student.id);

      if (access.error === "NOT_FOUND") {
        return fail(res, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");
      }

      if (access.error) {
        return fail(
          res,
          403,
          "ASSESSMENT_NOT_AVAILABLE",
          "This assessment is not currently available to you.",
        );
      }

      const { assessment, enrollmentIds } = access;

      if (assessment.dueAt && new Date() > assessment.dueAt) {
        return fail(
          res,
          403,
          "ASSESSMENT_DEADLINE_PASSED",
          "The deadline for this assessment has passed.",
        );
      }

      if (assessment.questions.length === 0) {
        return fail(
          res,
          409,
          "ASSESSMENT_EMPTY",
          "This assessment has no questions yet.",
        );
      }

      const enrollmentId = enrollmentIds[0];

      const existingAttempt = await prisma.assessmentAttempt.findFirst({
        where: {
          enrollmentId,
          assessmentId,
          status: "IN_PROGRESS",
        },
        orderBy: { attemptNumber: "desc" },
      });

      if (existingAttempt) {
        return res.json({
          data: {
            attempt: safeAttempt(existingAttempt),
            questions: assessment.questions.map(safeQuestion),
          },
        });
      }

      const latest = await prisma.assessmentAttempt.findFirst({
        where: { enrollmentId, assessmentId },
        orderBy: { attemptNumber: "desc" },
        select: { attemptNumber: true },
      });

      const attempt = await prisma.assessmentAttempt.create({
        data: {
          enrollmentId,
          assessmentId,
          attemptNumber: (latest?.attemptNumber ?? 0) + 1,
          answers: {},
          status: "IN_PROGRESS",
        },
      });

      return res.status(201).json({
        data: {
          attempt: safeAttempt(attempt),
          questions: assessment.questions.map(safeQuestion),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return fail(
          res,
          409,
          "ATTEMPT_CONFLICT",
          "An attempt was created simultaneously. Please reload your assessment.",
        );
      }

      console.error("Assessment start failed:", error.message);

      return fail(
        res,
        500,
        "INTERNAL_SERVER_ERROR",
        "Unable to start this assessment.",
      );
    }
  },
);

// Save or update answers.
router.patch(
  "/attempts/:attemptId/answers",
  requireSameOrigin,
  async (req, res) => {
    const attemptId = Number(req.params.attemptId);
    const parsed = answerSchema.safeParse(req.body?.answers);

    if (!Number.isSafeInteger(attemptId) || attemptId < 1) {
      return fail(res, 400, "INVALID_ID", "Invalid attempt ID.");
    }

    if (!parsed.success) {
      return fail(res, 400, "INVALID_ANSWERS", "Invalid answers payload.");
    }

    try {
      const attempt = await prisma.assessmentAttempt.findFirst({
        where: {
          id: attemptId,
          enrollment: {
            userId: req.student.id,
            status: "CONFIRMED",
          },
        },
        include: {
          assessment: {
            include: {
              questions: {
                select: {
                  id: true,
                  questionType: true,
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        return fail(res, 404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
      }

      if (attempt.status !== "IN_PROGRESS") {
        return fail(
          res,
          409,
          "ATTEMPT_CLOSED",
          "This attempt can no longer be modified.",
        );
      }

      if (isAttemptExpired(attempt)) {
        return fail(
          res,
          409,
          "ATTEMPT_TIME_EXPIRED",
          "The time limit has expired. Submit your saved answers to finish.",
        );
      }

      const allowedIds = new Set(
        attempt.assessment.questions.map((question) => String(question.id)),
      );

      for (const [questionId, answer] of Object.entries(parsed.data)) {
        if (!allowedIds.has(questionId)) {
          return fail(
            res,
            400,
            "UNKNOWN_QUESTION",
            "One or more answers refer to an invalid question.",
          );
        }

        if (
          typeof answer !== "string" &&
          typeof answer !== "boolean" &&
          typeof answer !== "number" &&
          !Array.isArray(answer)
        ) {
          return fail(
            res,
            400,
            "INVALID_ANSWER_FORMAT",
            "Answers must be strings, numbers, booleans, or arrays.",
          );
        }

        if (typeof answer === "string" && answer.length > 10_000) {
          return fail(
            res,
            400,
            "ANSWER_TOO_LONG",
            "An answer exceeds the maximum allowed length.",
          );
        }
      }

      const currentAnswers =
        attempt.answers &&
        typeof attempt.answers === "object" &&
        !Array.isArray(attempt.answers)
          ? attempt.answers
          : {};

      const updated = await prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          answers: {
            ...currentAnswers,
            ...parsed.data,
          },
        },
      });

      return res.json({
        data: { attempt: safeAttempt(updated) },
      });
    } catch (error) {
      console.error("Saving assessment answers failed:", error.message);

      return fail(
        res,
        500,
        "INTERNAL_SERVER_ERROR",
        "Unable to save your answers.",
      );
    }
  },
);

// Submit and automatically grade objective questions.
router.post(
  "/attempts/:attemptId/submit",
  requireSameOrigin,
  async (req, res) => {
    const attemptId = Number(req.params.attemptId);

    if (!Number.isSafeInteger(attemptId) || attemptId < 1) {
      return fail(res, 400, "INVALID_ID", "Invalid attempt ID.");
    }

    try {
      const attempt = await prisma.assessmentAttempt.findFirst({
        where: {
          id: attemptId,
          enrollment: {
            userId: req.student.id,
            status: "CONFIRMED",
          },
        },
        include: {
          assessment: {
            include: {
              questions: true,
            },
          },
        },
      });

      if (!attempt) {
        return fail(res, 404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
      }

      if (attempt.status !== "IN_PROGRESS") {
        return fail(
          res,
          409,
          "ATTEMPT_ALREADY_SUBMITTED",
          "This attempt has already been submitted.",
        );
      }

      const answers =
        attempt.answers &&
        typeof attempt.answers === "object" &&
        !Array.isArray(attempt.answers)
          ? attempt.answers
          : {};

      let earnedPoints = 0;
      let autoGradablePoints = 0;
      let requiresManualGrading = false;

      for (const question of attempt.assessment.questions) {
        const answer = answers[String(question.id)];
        const result = answersMatch(question, answer);

        if (result === null) {
          requiresManualGrading = true;
          continue;
        }

        autoGradablePoints += question.points;

        if (result) {
          earnedPoints += question.points;
        }
      }

      const totalPoints = attempt.assessment.questions.reduce(
        (sum, question) => sum + question.points,
        0,
      );

      const allQuestionsAutoGradable = !requiresManualGrading;

      const score =
        allQuestionsAutoGradable && totalPoints > 0
          ? (earnedPoints / totalPoints) *
            (attempt.assessment.maxScore ?? totalPoints)
          : null;

      const updated = await prisma.assessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: allQuestionsAutoGradable ? "GRADED" : "SUBMITTED",
          submittedAt: new Date(),
          ...(allQuestionsAutoGradable
            ? {
                score: new Prisma.Decimal(Number(score.toFixed(2))),
                gradedAt: new Date(),
              }
            : {}),
        },
      });

      return res.json({
        data: {
          attempt: safeAttempt(updated),
          grading: {
            automaticallyGraded: allQuestionsAutoGradable,
            earnedPoints: allQuestionsAutoGradable ? earnedPoints : null,
            autoGradablePoints,
            totalPoints,
            pendingManualGrading: requiresManualGrading,
          },
        },
      });
    } catch (error) {
      console.error("Assessment submission failed:", error.message);

      return fail(
        res,
        500,
        "INTERNAL_SERVER_ERROR",
        "Unable to submit this assessment.",
      );
    }
  },
);

// View the student's own attempt and result.
router.get("/attempts/:attemptId", async (req, res) => {
  const attemptId = Number(req.params.attemptId);

  if (!Number.isSafeInteger(attemptId) || attemptId < 1) {
    return fail(res, 400, "INVALID_ID", "Invalid attempt ID.");
  }

  try {
    const attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        id: attemptId,
        enrollment: { userId: req.student.id },
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            maxScore: true,
            questions: {
              orderBy: { position: "asc" },
              select: {
                id: true,
                prompt: true,
                questionType: true,
                points: true,
                explanation: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return fail(res, 404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
    }

    const result = safeAttempt(attempt);
    const graded = attempt.status === "GRADED";

    return res.json({
      data: {
        attempt: result,
        assessment: attempt.assessment,
        explanations: graded
          ? attempt.assessment.questions.map((question) => ({
              questionId: question.id,
              explanation: question.explanation,
            }))
          : [],
      },
    });
  } catch (error) {
    console.error("Loading assessment attempt failed:", error.message);

    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load this attempt.",
    );
  }
});

export default router;
