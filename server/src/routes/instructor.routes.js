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

export default router;
