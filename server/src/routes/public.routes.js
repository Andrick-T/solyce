import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const router = Router();

const activeEnrollmentStatuses = {
  notIn: ["CANCELLED", "WAITLISTED"],
};

function getOpenCohortWhere() {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return {
    status: "OPEN",
    startDate: { gte: today },
    instructorId: { not: null },
    instructor: {
      is: {
        role: "INSTRUCTOR",
        isActive: true,
      },
    },
    OR: [{ enrollmentDeadline: null }, { enrollmentDeadline: { gte: now } }],
  };
}

function getCohortSelect() {
  return {
    id: true,
    name: true,
    startDate: true,
    endDate: true,
    enrollmentDeadline: true,
    scheduleDescription: true,
    timezone: true,
    capacity: true,
    minimumStudents: true,
    priceXaf: true,
    status: true,
    enrollments: {
      where: {
        status: activeEnrollmentStatuses,
      },
      select: {
        id: true,
      },
    },
  };
}

function serializeCohort(cohort, coursePriceXaf = null) {
  const { enrollments, ...cohortData } = cohort;
  const enrolledCount = enrollments.length;

  return {
    ...cohortData,
    priceXaf: cohort.priceXaf ?? coursePriceXaf,
    enrolledCount,
    seatsRemaining: Math.max(0, cohort.capacity - enrolledCount),
  };
}

function serializeCourse(course) {
  const { cohorts, ...courseData } = course;

  return {
    ...courseData,
    cohorts: cohorts.map((cohort) => serializeCohort(cohort, course.priceXaf)),
  };
}

function handlePublicApiError(res, error, operation) {
  console.error(`${operation} failed:`, error);

  return res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to complete your request right now.",
    },
  });
}

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  language: true,
  examType: true,
  durationWeeks: true,
  curriculum: true,
  priceXaf: true,
  cohorts: {
    where: getOpenCohortWhere(),
    orderBy: { startDate: "asc" },
    select: getCohortSelect(),
  },
};

// GET /api/courses
// Returns published courses and their upcoming bookable cohorts.
router.get("/courses", async (_req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { title: "asc" },
      select: courseSelect,
    });

    return res.status(200).json({
      data: courses.map(serializeCourse),
      count: courses.length,
    });
  } catch (error) {
    return handlePublicApiError(res, error, "Course listing");
  }
});

// GET /api/courses/:slug
// Returns one published course and its upcoming bookable cohorts.
router.get("/courses/:slug", async (req, res) => {
  const slugSchema = z
    .string()
    .min(1)
    .max(191)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

  const parsedSlug = slugSchema.safeParse(req.params.slug);

  if (!parsedSlug.success) {
    return res.status(400).json({
      error: {
        code: "INVALID_COURSE_SLUG",
        message: "Please provide a valid course slug.",
      },
    });
  }

  try {
    const course = await prisma.course.findFirst({
      where: {
        slug: parsedSlug.data,
        isPublished: true,
      },
      select: courseSelect,
    });

    if (!course) {
      return res.status(404).json({
        error: {
          code: "COURSE_NOT_FOUND",
          message: "The requested course was not found.",
        },
      });
    }

    return res.status(200).json({
      data: serializeCourse(course),
    });
  } catch (error) {
    return handlePublicApiError(res, error, "Course details");
  }
});

// GET /api/cohorts
// Returns upcoming bookable cohorts for published courses.
router.get("/cohorts", async (_req, res) => {
  try {
    const cohorts = await prisma.cohort.findMany({
      where: {
        ...getOpenCohortWhere(),
        course: {
          isPublished: true,
        },
      },
      orderBy: { startDate: "asc" },
      select: {
        ...getCohortSelect(),
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            language: true,
            examType: true,
            priceXaf: true,
          },
        },
      },
    });

    const data = cohorts.map((cohort) => {
      const { course, ...cohortData } = cohort;

      return {
        ...serializeCohort(cohortData, course.priceXaf),
        course,
      };
    });

    return res.status(200).json({
      data,
      count: data.length,
    });
  } catch (error) {
    return handlePublicApiError(res, error, "Cohort listing");
  }
});

export default router;
