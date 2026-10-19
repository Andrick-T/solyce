import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireInstructor);

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const programFields = {
  slug: slugSchema,
  title: z.string().trim().min(3).max(191),
  description: z.string().trim().min(10).max(20000),
  language: z.enum(["ENGLISH", "FRENCH"]),
  examType: z.string().trim().min(1).max(50),
  durationWeeks: z.number().int().min(1).max(104),
  curriculum: z.string().max(30000).nullable().optional(),
  priceXaf: z.number().int().min(0).max(100000000),
};

const createSchema = z.object(programFields).strict();

const updateSchema = z
  .object(programFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0);

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function validationError(res, error) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "Please review the submitted program information.",
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
      "DUPLICATE_PROGRAM_SLUG",
      "A program with this slug already exists.",
    );
  }

  console.error(`${operation} failed:`, error.message);

  return fail(
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "Unable to complete this program operation.",
  );
}

// GET /api/instructor/programs
router.get("/", async (req, res) => {
  try {
    const data = await prisma.course.findMany({
      where: { createdById: req.instructor.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        examType: true,
        durationWeeks: true,
        priceXaf: true,
        approvalStatus: true,
        isPublished: true,
        updatedAt: true,
        _count: {
          select: { modules: true, cohorts: true },
        },
      },
    });

    return res.json({ data, count: data.length });
  } catch (error) {
    return handleError(res, error, "Instructor program listing");
  }
});

// GET /api/instructor/programs/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return fail(res, 400, "INVALID_PROGRAM_ID", "Invalid program ID.");
  }

  try {
    const data = await prisma.course.findFirst({
      where: { id, createdById: req.instructor.id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        language: true,
        examType: true,
        durationWeeks: true,
        curriculum: true,
        priceXaf: true,
        approvalStatus: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        modules: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            position: true,
            isPublished: true,
            _count: { select: { lessons: true } },
          },
        },
      },
    });

    if (!data) {
      return fail(res, 404, "PROGRAM_NOT_FOUND", "Program not found.");
    }

    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor program details");
  }
});

// POST /api/instructor/programs
router.post("/", requireSameOrigin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const data = await prisma.course.create({
      data: {
        ...parsed.data,
        createdById: req.instructor.id,
        approvalStatus: "DRAFT",
        isPublished: false,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        examType: true,
        durationWeeks: true,
        priceXaf: true,
        approvalStatus: true,
        isPublished: true,
      },
    });

    return res.status(201).json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor program creation");
  }
});

// PATCH /api/instructor/programs/:id
router.patch("/:id", requireSameOrigin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return fail(res, 400, "INVALID_PROGRAM_ID", "Invalid program ID.");
  }

  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  try {
    const existing = await prisma.course.findFirst({
      where: { id, createdById: req.instructor.id },
      select: { id: true, approvalStatus: true },
    });

    if (!existing) {
      return fail(res, 404, "PROGRAM_NOT_FOUND", "Program not found.");
    }

    if (!["DRAFT", "REJECTED"].includes(existing.approvalStatus)) {
      return fail(
        res,
        409,
        "PROGRAM_NOT_EDITABLE",
        "Only draft or rejected programs can be edited.",
      );
    }

    const data = await prisma.course.update({
      where: { id },
      data: {
        ...parsed.data,
        approvalStatus: "DRAFT",
        isPublished: false,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        approvalStatus: true,
        isPublished: true,
        updatedAt: true,
      },
    });

    return res.json({ data });
  } catch (error) {
    return handleError(res, error, "Instructor program update");
  }
});

// POST /api/instructor/programs/:id/submit
router.post("/:id/submit", requireSameOrigin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return fail(res, 400, "INVALID_PROGRAM_ID", "Invalid program ID.");
  }

  try {
    const existing = await prisma.course.findFirst({
      where: { id, createdById: req.instructor.id },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        examType: true,
        durationWeeks: true,
        priceXaf: true,
        approvalStatus: true,
      },
    });

    if (!existing) {
      return fail(res, 404, "PROGRAM_NOT_FOUND", "Program not found.");
    }

    if (!["DRAFT", "REJECTED"].includes(existing.approvalStatus)) {
      return fail(
        res,
        409,
        "PROGRAM_ALREADY_SUBMITTED",
        "This program cannot be submitted in its current state.",
      );
    }

    if (
      !existing.title?.trim() ||
      !existing.description?.trim() ||
      !existing.language ||
      !existing.examType?.trim() ||
      !existing.durationWeeks ||
      existing.priceXaf < 0
    ) {
      return fail(
        res,
        400,
        "PROGRAM_INCOMPLETE",
        "Complete all required program details before submitting.",
      );
    }

    const result = await prisma.course.updateMany({
      where: {
        id,
        createdById: req.instructor.id,
        approvalStatus: { in: ["DRAFT", "REJECTED"] },
      },
      data: {
        approvalStatus: "PENDING_REVIEW",
        isPublished: false,
      },
    });

    if (result.count === 0) {
      return fail(
        res,
        409,
        "PROGRAM_ALREADY_SUBMITTED",
        "This program has already been submitted or is no longer editable.",
      );
    }

    const data = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        approvalStatus: true,
        isPublished: true,
        updatedAt: true,
      },
    });

    return res.json({
      data,
      message: "Program submitted for administrator review.",
    });
  } catch (error) {
    return handleError(res, error, "Instructor program submission");
  }
});

export default router;
