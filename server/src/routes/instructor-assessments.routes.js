import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireInstructor);

function fail(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

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

function instructorAttemptWhere(instructorId, attemptId) {
  return {
    id: attemptId,
    status: "SUBMITTED",
    enrollment: {
      cohort: {
        instructorId,
      },
    },
  };
}

// GET /api/instructor/assessments
router.get("/", async (req, res) => {
  try {
    const assessments = await prisma.assessment.findMany({
      where: {
        lesson: {
          module: {
            course: {
              cohorts: {
                some: {
                  instructorId: req.instructor.id,
                },
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        assessmentType: true,
        maxScore: true,
        passingScore: true,
        dueAt: true,
        isPublished: true,
        lesson: {
          select: {
            id: true,
            title: true,
            module: {
              select: {
                id: true,
                title: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { attempts: true },
        },
      },
    });

    const data = await Promise.all(
      assessments.map(async (assessment) => {
        const lessonCourseId = assessment.lesson.module.course.id;

        const [submitted, graded, inProgress] = await Promise.all([
          prisma.assessmentAttempt.count({
            where: {
              assessmentId: assessment.id,
              status: "SUBMITTED",
              enrollment: {
                cohort: {
                  instructorId: req.instructor.id,
                  courseId: lessonCourseId,
                },
              },
            },
          }),
          prisma.assessmentAttempt.count({
            where: {
              assessmentId: assessment.id,
              status: "GRADED",
              enrollment: {
                cohort: {
                  instructorId: req.instructor.id,
                  courseId: lessonCourseId,
                },
              },
            },
          }),
          prisma.assessmentAttempt.count({
            where: {
              assessmentId: assessment.id,
              status: "IN_PROGRESS",
              enrollment: {
                cohort: {
                  instructorId: req.instructor.id,
                  courseId: lessonCourseId,
                },
              },
            },
          }),
        ]);

        return {
          ...assessment,
          attempts: {
            total: submitted + graded + inProgress,
            submitted,
            graded,
            inProgress,
          },
        };
      }),
    );

    return res.json({ data, count: data.length });
  } catch (error) {
    console.error("Instructor assessments failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load assessments.",
    );
  }
});

/**
 * GET /api/instructor/assessments/:assessmentId/attempts
 * Lists submitted and graded attempts for an assessment
 * belonging to a course assigned to the authenticated instructor.
 */
router.get("/:assessmentId/attempts", async (req, res) => {
  const assessmentId = parseId(req.params.assessmentId);

  if (!assessmentId) {
    return fail(res, 400, "INVALID_ASSESSMENT_ID", "Invalid assessment ID.");
  }

  try {
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        lesson: {
          module: {
            course: {
              cohorts: {
                some: {
                  instructorId: req.instructor.id,
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        maxScore: true,
        lesson: {
          select: {
            title: true,
            module: {
              select: {
                title: true,
                course: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return fail(res, 404, "ASSESSMENT_NOT_FOUND", "Assessment not found.");
    }

    const attempts = await prisma.assessmentAttempt.findMany({
      where: {
        assessmentId,
        status: { in: ["SUBMITTED", "GRADED"] },
        enrollment: {
          cohort: {
            instructorId: req.instructor.id,
            courseId: assessment.lesson.module.course.id,
          },
        },
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        attemptNumber: true,
        score: true,
        submittedAt: true,
        gradedAt: true,
        enrollment: {
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
            cohort: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return res.json({
      data: {
        assessment,
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          status: attempt.status,
          attemptNumber: attempt.attemptNumber,
          score: attempt.score,
          submittedAt: attempt.submittedAt,
          gradedAt: attempt.gradedAt,
          student: attempt.enrollment.user
            ? {
                fullName: attempt.enrollment.user.fullName,
                email: attempt.enrollment.user.email,
              }
            : {
                fullName: attempt.enrollment.guestFullName || "Guest student",
                email: attempt.enrollment.guestEmail,
              },
          cohort: attempt.enrollment.cohort,
        })),
      },
    });
  } catch (error) {
    console.error("Instructor assessment attempts failed:", error.message);

    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load assessment attempts.",
    );
  }
});

// GET /api/instructor/assessments/attempts/:id
router.get("/attempts/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return fail(res, 400, "INVALID_ATTEMPT_ID", "Invalid attempt ID.");
  }

  try {
    const attempt = await prisma.assessmentAttempt.findFirst({
      where: {
        id,
        enrollment: {
          cohort: {
            instructorId: req.instructor.id,
          },
        },
      },
      include: {
        assessment: {
          include: {
            questions: {
              orderBy: { position: "asc" },
            },
            lesson: {
              select: {
                title: true,
                module: {
                  select: {
                    title: true,
                    course: { select: { id: true, title: true } },
                  },
                },
              },
            },
          },
        },
        enrollment: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
            cohort: {
              select: { id: true, name: true, courseId: true },
            },
          },
        },
      },
    });

    if (
      !attempt ||
      attempt.enrollment.cohort.courseId !==
        attempt.assessment.lesson.module.course.id
    ) {
      return fail(res, 404, "ATTEMPT_NOT_FOUND", "Attempt not found.");
    }

    // An instructor may view their assigned students' attempts,
    // but only submitted attempts can be graded.
    return res.json({
      data: {
        id: attempt.id,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
        answers: attempt.answers,
        score: attempt.score,
        feedback: attempt.feedback,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        assessment: {
          id: attempt.assessment.id,
          title: attempt.assessment.title,
          maxScore: attempt.assessment.maxScore,
          passingScore: attempt.assessment.passingScore,
          lesson: attempt.assessment.lesson.title,
          module: attempt.assessment.lesson.module.title,
          course: attempt.assessment.lesson.module.course.title,
          questions: attempt.assessment.questions.map((question) => {
            const canReviewAnswers =
              attempt.status === "SUBMITTED" || attempt.status === "GRADED";

            return {
              id: question.id,
              prompt: question.prompt,
              questionType: question.questionType,
              options: question.options,
              ...(canReviewAnswers
                ? {
                    correctAnswer: question.correctAnswer,
                    explanation: question.explanation,
                  }
                : {}),
              points: question.points,
              position: question.position,
            };
          }),
        },
        student: attempt.enrollment.user
          ? {
              fullName: attempt.enrollment.user.fullName,
              email: attempt.enrollment.user.email,
            }
          : { fullName: "Guest student", email: null },
        cohort: attempt.enrollment.cohort,
      },
    });
  } catch (error) {
    console.error("Instructor attempt details failed:", error.message);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load this attempt.",
    );
  }
});

// PATCH /api/instructor/assessments/attempts/:id/grade

router.patch("/attempts/:id/grade", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  const parsed = gradeSchema.safeParse(req.body);

  if (!id) {
    return fail(res, 400, "INVALID_ATTEMPT_ID", "Invalid attempt ID.");
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
      const attempt = await tx.assessmentAttempt.findFirst({
        where: instructorAttemptWhere(req.instructor.id, id),
        include: {
          assessment: {
            include: {
              questions: {
                orderBy: { position: "asc" },
              },
              lesson: {
                select: {
                  module: {
                    select: {
                      course: {
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
          enrollment: {
            include: {
              cohort: {
                select: { courseId: true },
              },
            },
          },
        },
      });

      if (
        !attempt ||
        attempt.enrollment.cohort.courseId !==
          attempt.assessment.lesson.module.course.id
      ) {
        return { error: "NOT_GRADEABLE" };
      }

      if (!attempt) return { error: "NOT_GRADEABLE" };

      const questions = attempt.assessment.questions;
      let finalScore;

      if (parsed.data.questionScores !== undefined) {
        const scores = parsed.data.questionScores;
        const questionById = new Map(
          questions.map((question) => [question.id, question]),
        );
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

      const maxScore = attempt.assessment.maxScore;

      if (maxScore !== null && finalScore > maxScore) {
        return { error: "SCORE_EXCEEDS_MAX" };
      }

      const updated = await tx.assessmentAttempt.update({
        where: { id },
        data: {
          score: new Prisma.Decimal(finalScore.toFixed(2)),
          feedback: parsed.data.feedback ?? null,
          status: "GRADED",
          gradedAt: new Date(),
          gradedById: req.instructor.id,
        },
        select: {
          id: true,
          status: true,
          score: true,
          feedback: true,
          gradedAt: true,
        },
      });

      return { attempt: updated };
    });

    const errors = {
      NOT_GRADEABLE: [
        404,
        "ATTEMPT_NOT_GRADEABLE",
        "This submitted attempt was not found in your assigned cohorts.",
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
      const [status, code, message] = errors[result.error];
      return fail(res, status, code, message);
    }

    return res.json({ data: result.attempt });
  } catch (error) {
    console.error("Instructor grading failed:", error.message);

    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to grade this attempt.",
    );
  }
});

export default router;
