import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireStudent } from "../middleware/require-student.js";

const router = Router();

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function getAccessiblePhase(
  scheduledAt,
  scheduledEndAt,
  preparationLeadMinutes,
  now,
) {
  const preparationOpensAt =
    scheduledAt.getTime() - preparationLeadMinutes * 60 * 1000;

  if (now.getTime() >= scheduledEndAt.getTime()) {
    return "AFTER_SESSION";
  }

  if (now.getTime() >= preparationOpensAt) {
    return "PREPARATION";
  }

  return "LOCKED";
}

function safeAssessment(assessment) {
  return {
    ...assessment,
    questions: assessment.questions.map((question) => {
      const { correctAnswer, explanation, ...safeQuestion } = question;

      return safeQuestion;
    }),
  };
}

function getMeetingDetails(session, accessPhase) {
  if (accessPhase === "LOCKED") {
    return {
      meetingProvider: null,
      meetingUrl: null,
    };
  }

  return {
    meetingProvider: session.meetingProvider,
    meetingUrl: session.meetingUrl,
  };
}

// GET /api/student/learning
// Lists sessions for which the signed-in student has a confirmed enrollment.
router.get("/", requireStudent, async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: req.student.id,
        status: "CONFIRMED",
        cohort: { status: { not: "CANCELLED" } },
      },
      select: {
        id: true,
        status: true,
        cohortId: true,
        cohort: {
          select: {
            id: true,
            name: true,
            timezone: true,
            status: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (enrollments.length === 0) {
      return res.json({ data: [], count: 0 });
    }

    const enrollmentByCohort = new Map(
      enrollments.map((enrollment) => [enrollment.cohortId, enrollment]),
    );

    const sessions = await prisma.cohortLesson.findMany({
      where: {
        cohortId: {
          in: enrollments.map((enrollment) => enrollment.cohortId),
        },
        status: { not: "CANCELLED" },
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            course: {
              isPublished: true,
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        lesson: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                position: true,
              },
            },
            resources: {
              where: { isPublished: true },
              orderBy: { position: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                resourceType: true,
                url: true,
                releasePhase: true,
                position: true,
              },
            },
            assessments: {
              where: { isPublished: true },
              orderBy: { createdAt: "asc" },
              include: {
                questions: {
                  orderBy: { position: "asc" },
                  select: {
                    id: true,
                    questionType: true,
                    prompt: true,
                    options: true,
                    explanation: true,
                    points: true,
                    position: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const now = new Date();

    const data = sessions.map((session) => {
      const enrollment = enrollmentByCohort.get(session.cohortId);

      const accessPhase = getAccessiblePhase(
        session.scheduledAt,
        session.scheduledEndAt,
        session.preparationLeadMinutes,
        now,
      );

      const meetingDetails = getMeetingDetails(session, accessPhase);

      const resources = session.lesson.resources.filter((resource) =>
        accessPhase === "AFTER_SESSION"
          ? true
          : accessPhase === "PREPARATION"
            ? resource.releasePhase === "PREPARATION"
            : false,
      );

      const assessments = session.lesson.assessments
        .filter((assessment) =>
          accessPhase === "AFTER_SESSION"
            ? true
            : accessPhase === "PREPARATION"
              ? assessment.releasePhase === "PREPARATION"
              : false,
        )
        .map(safeAssessment);

      return {
        id: session.id,
        cohortId: session.cohortId,
        scheduledAt: session.scheduledAt,
        scheduledEndAt: session.scheduledEndAt,
        preparationLeadMinutes: session.preparationLeadMinutes,
        status: session.status,
        accessPhase,
        ...meetingDetails,
        instructorNotes:
          accessPhase === "AFTER_SESSION" ? session.instructorNotes : null,
        preparationContent:
          accessPhase === "PREPARATION" || accessPhase === "AFTER_SESSION"
            ? session.lesson.preparationContent
            : null,
        content:
          accessPhase === "AFTER_SESSION" ? session.lesson.content : null,
        lesson: {
          id: session.lesson.id,
          title: session.lesson.title,
          description: session.lesson.description,
          objectives: session.lesson.objectives,
          estimatedMinutes: session.lesson.estimatedMinutes,
          position: session.lesson.position,
          module: session.lesson.module,
        },
        resources,
        assessments,
        enrollment: {
          id: enrollment.id,
          status: enrollment.status,
        },
        cohort: enrollment.cohort,
      };
    });

    return res.json({ data, count: data.length });
  } catch (error) {
    console.error("Student learning listing failed:", error.message);

    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load your learning programme right now.",
    );
  }
});

// GET /api/student/learning/sessions/:id
router.get("/sessions/:id", requireStudent, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return fail(res, 400, "INVALID_SESSION_ID", "Provide a valid session ID.");
  }

  try {
    const session = await prisma.cohortLesson.findFirst({
      where: {
        id,
        status: { not: "CANCELLED" },
        cohort: {
          status: { not: "CANCELLED" },
          enrollments: {
            some: {
              userId: req.student.id,
              status: "CONFIRMED",
            },
          },
        },
        lesson: {
          isPublished: true,
          module: {
            isPublished: true,
            course: {
              isPublished: true,
            },
          },
        },
      },
      include: {
        cohort: {
          select: {
            id: true,
            name: true,
            timezone: true,
            status: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
        lesson: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                position: true,
              },
            },
            resources: {
              where: { isPublished: true },
              orderBy: { position: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                resourceType: true,
                url: true,
                releasePhase: true,
                position: true,
              },
            },
            assessments: {
              where: { isPublished: true },
              orderBy: { createdAt: "asc" },
              include: {
                questions: {
                  orderBy: { position: "asc" },
                  select: {
                    id: true,
                    questionType: true,
                    prompt: true,
                    options: true,
                    explanation: true,
                    points: true,
                    position: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return fail(
        res,
        404,
        "LEARNING_SESSION_NOT_FOUND",
        "This learning session is unavailable or you are not enrolled in its cohort.",
      );
    }

    const now = new Date();

    const accessPhase = getAccessiblePhase(
      session.scheduledAt,
      session.scheduledEndAt,
      session.preparationLeadMinutes,
      now,
    );

    const meetingDetails = getMeetingDetails(session, accessPhase);

    const resources = session.lesson.resources.filter((resource) =>
      accessPhase === "AFTER_SESSION"
        ? true
        : accessPhase === "PREPARATION"
          ? resource.releasePhase === "PREPARATION"
          : false,
    );

    const assessments = session.lesson.assessments
      .filter((assessment) =>
        accessPhase === "AFTER_SESSION"
          ? true
          : accessPhase === "PREPARATION"
            ? assessment.releasePhase === "PREPARATION"
            : false,
      )
      .map(safeAssessment);

    return res.json({
      data: {
        id: session.id,
        cohortId: session.cohortId,
        scheduledAt: session.scheduledAt,
        scheduledEndAt: session.scheduledEndAt,
        preparationLeadMinutes: session.preparationLeadMinutes,
        status: session.status,
        accessPhase,
        ...meetingDetails,
        instructorNotes:
          accessPhase === "AFTER_SESSION" ? session.instructorNotes : null,
        preparationContent:
          accessPhase === "PREPARATION" || accessPhase === "AFTER_SESSION"
            ? session.lesson.preparationContent
            : null,
        content:
          accessPhase === "AFTER_SESSION" ? session.lesson.content : null,
        lesson: {
          id: session.lesson.id,
          title: session.lesson.title,
          description: session.lesson.description,
          objectives: session.lesson.objectives,
          estimatedMinutes: session.lesson.estimatedMinutes,
          position: session.lesson.position,
          module: session.lesson.module,
        },
        resources,
        assessments,
        cohort: session.cohort,
      },
    });
  } catch (error) {
    console.error("Student learning session details failed:", error.message);

    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load this learning session right now.",
    );
  }
});

export default router;
