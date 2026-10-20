import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";

const router = Router();

router.use(requireInstructor);

router.get("/dashboard", async (req, res) => {
  try {
    const cohorts = await prisma.cohort.findMany({
      where: {
        instructorId: req.instructor.id,
      },
      orderBy: [{ startDate: "desc" }, { id: "desc" }],
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        scheduleDescription: true,
        status: true,
        capacity: true,
        course: {
          select: {
            id: true,
            title: true,
            language: true,
            isPublished: true,
          },
        },
        enrollments: {
          where: {
            status: "CONFIRMED",
          },
          select: {
            id: true,
          },
        },
      },
    });

    const data = cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
      scheduleDescription: cohort.scheduleDescription,
      status: cohort.status,
      capacity: cohort.capacity,
      confirmedStudents: cohort.enrollments.length,
      course: cohort.course,
    }));

    return res.status(200).json({
      data: {
        user: req.instructor,
        stats: {
          assignedCohorts: data.length,
          activeCohorts: data.filter((cohort) =>
            ["OPEN", "IN_PROGRESS"].includes(cohort.status),
          ).length,
          confirmedStudents: data.reduce(
            (total, cohort) => total + cohort.confirmedStudents,
            0,
          ),
          programs: new Set(data.map((cohort) => cohort.course.id)).size,
        },
        cohorts: data,
      },
    });
  } catch (error) {
    console.error("Instructor dashboard failed:", error.message);

    return res.status(500).json({
      error: {
        code: "DASHBOARD_LOAD_FAILED",
        message: "Unable to load your instructor dashboard.",
      },
    });
  }
});

// Detailed view of a cohort assigned to the authenticated instructor.
router.get("/cohorts/:id", async (req, res) => {
  const cohortId = Number(req.params.id);

  if (!Number.isSafeInteger(cohortId) || cohortId <= 0) {
    return res.status(400).json({
      error: {
        code: "INVALID_COHORT_ID",
        message: "Invalid cohort ID.",
      },
    });
  }

  try {
    const cohort = await prisma.cohort.findFirst({
      where: {
        id: cohortId,
        instructorId: req.instructor.id,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        enrollmentDeadline: true,
        scheduleDescription: true,
        timezone: true,
        capacity: true,
        minimumStudents: true,
        status: true,
        course: {
          select: {
            id: true,
            title: true,
            language: true,
            examType: true,
            durationWeeks: true,
          },
        },
        enrollments: {
          orderBy: [{ enrolledAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            enrolledAt: true,
            confirmedAt: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            guestFullName: true,
            guestEmail: true,
            guestPhone: true,
          },
        },
        scheduledLessons: {
          orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            scheduledAt: true,
            scheduledEndAt: true,
            status: true,
            instructorNotes: true,
            meetingProvider: true,
            meetingUrl: true,
            lesson: {
              select: {
                id: true,
                title: true,
                description: true,
                position: true,
                module: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Do not disclose whether a cohort exists if it is not assigned
    // to the currently authenticated instructor.
    if (!cohort) {
      return res.status(404).json({
        error: {
          code: "COHORT_NOT_FOUND",
          message: "Cohort not found.",
        },
      });
    }

    const enrollments = cohort.enrollments.map((enrollment) => ({
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      confirmedAt: enrollment.confirmedAt,
      student: enrollment.user
        ? {
            id: enrollment.user.id,
            fullName: enrollment.user.fullName,
            email: enrollment.user.email,
            phone: null,
            isGuest: false,
          }
        : {
            id: null,
            fullName: enrollment.guestFullName || "Guest student",
            email: enrollment.guestEmail,
            phone: enrollment.guestPhone,
            isGuest: true,
          },
    }));

    return res.status(200).json({
      data: {
        ...cohort,
        enrollments,
        confirmedStudents: enrollments.filter(
          (enrollment) => enrollment.status === "CONFIRMED",
        ).length,
      },
    });
  } catch (error) {
    console.error("Instructor cohort detail failed:", error.message);

    return res.status(500).json({
      error: {
        code: "COHORT_LOAD_FAILED",
        message: "Unable to load this cohort.",
      },
    });
  }
});

export default router;
