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
    score: z.number().finite().min(0),
    feedback: z.string().trim().max(10000).nullable().optional(),
  })
  .strict();

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

    if (!attempt) {
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
      "Provide a valid score and feedback.",
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findFirst({
        where: instructorAttemptWhere(req.instructor.id, id),
        include: {
          assessment: {
            select: { maxScore: true },
          },
        },
      });

      if (!attempt) {
        return { error: "NOT_GRADEABLE" };
      }

      if (
        attempt.assessment.maxScore !== null &&
        parsed.data.score > attempt.assessment.maxScore
      ) {
        return { error: "SCORE_TOO_HIGH" };
      }

      const updated = await tx.assessmentAttempt.update({
        where: { id },
        data: {
          score: new Prisma.Decimal(parsed.data.score.toFixed(2)),
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

    if (result.error === "NOT_GRADEABLE") {
      return fail(
        res,
        404,
        "ATTEMPT_NOT_GRADEABLE",
        "This submitted attempt was not found in your assigned cohorts.",
      );
    }

    if (result.error === "SCORE_TOO_HIGH") {
      return fail(
        res,
        400,
        "SCORE_TOO_HIGH",
        "The score exceeds the assessment maximum.",
      );
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
