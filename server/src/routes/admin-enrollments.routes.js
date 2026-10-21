import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireAdmin);

const statuses = [
  "PENDING",
  "AWAITING_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "CONFIRMED",
  "CANCELLED",
  "WAITLISTED",
];

function parseId(value) {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function errorResponse(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

const enrollmentInclude = {
  cohort: {
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      course: { select: { id: true, title: true } },
    },
  },
  user: {
    select: { id: true, fullName: true, email: true },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      expectedAmountXaf: true,
      receivedAmountXaf: true,
      method: true,
      status: true,
      transactionReference: true,
      verificationNote: true,
      verifiedAt: true,
      createdAt: true,
    },
  },
};

router.get("/", async (req, res) => {
  const status = req.query.status;

  if (status && status !== "ALL" && !statuses.includes(status)) {
    return errorResponse(
      res,
      400,
      "INVALID_STATUS",
      "Invalid enrollment status.",
    );
  }

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      include: enrollmentInclude,
      orderBy: { createdAt: "desc" },
    });

    const data = enrollments.map((enrollment) => ({
      ...enrollment,
      student: enrollment.user
        ? {
            fullName: enrollment.user.fullName,
            email: enrollment.user.email,
            phone: enrollment.guestPhone,
          }
        : {
            fullName: enrollment.guestFullName,
            email: enrollment.guestEmail,
            phone: enrollment.guestPhone,
          },
      bookingReference: `SOL-${String(enrollment.id).padStart(6, "0")}`,
    }));

    return res.json({ data, count: data.length });
  } catch (error) {
    console.error("Admin enrollment listing failed:", error);
    return errorResponse(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load enrollments.",
    );
  }
});

router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id)
    return errorResponse(res, 400, "INVALID_ID", "Invalid enrollment ID.");

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: enrollmentInclude,
    });

    if (!enrollment) {
      return errorResponse(
        res,
        404,
        "ENROLLMENT_NOT_FOUND",
        "Enrollment not found.",
      );
    }

    return res.json({
      data: {
        ...enrollment,
        student: enrollment.user
          ? {
              fullName: enrollment.user.fullName,
              email: enrollment.user.email,
              phone: null,
            }
          : {
              fullName: enrollment.guestFullName,
              email: enrollment.guestEmail,
              phone: enrollment.guestPhone,
            },
        bookingReference: `SOL-${String(enrollment.id).padStart(6, "0")}`,
      },
    });
  } catch (error) {
    console.error("Admin enrollment detail failed:", error);
    return errorResponse(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load this enrollment.",
    );
  }
});

router.patch("/:id/status", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id)
    return errorResponse(res, 400, "INVALID_ID", "Invalid enrollment ID.");

  const parsed = z
    .object({
      status: z.enum(statuses),
    })
    .strict()
    .safeParse(req.body);

  if (!parsed.success) {
    return errorResponse(
      res,
      400,
      "VALIDATION_ERROR",
      "Provide a valid enrollment status.",
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id },
        include: { payments: true },
      });

      if (!enrollment) return { error: "NOT_FOUND" };

      if (parsed.data.status === "CONFIRMED") {
        const hasVerifiedPayment = enrollment.payments.some(
          (payment) =>
            payment.status === "VERIFIED" &&
            payment.receivedAmountXaf >= payment.expectedAmountXaf,
        );

        if (!hasVerifiedPayment) return { error: "PAYMENT_REQUIRED" };
      }

      if (
        enrollment.status === "CANCELLED" &&
        parsed.data.status !== "CANCELLED"
      ) {
        return { error: "TERMINAL_STATUS" };
      }

      const data = { status: parsed.data.status };

      if (parsed.data.status === "CANCELLED") {
        data.cancelledAt = new Date();
        data.confirmedAt = null;
      } else if (parsed.data.status === "CONFIRMED") {
        data.confirmedAt = enrollment.confirmedAt || new Date();
        data.cancelledAt = null;
      } else {
        data.confirmedAt = null;
        data.cancelledAt = null;
      }

      return {
        enrollment: await tx.enrollment.update({
          where: { id },
          data,
          include: enrollmentInclude,
        }),
      };
    });

    if (updated.error === "NOT_FOUND") {
      return errorResponse(
        res,
        404,
        "ENROLLMENT_NOT_FOUND",
        "Enrollment not found.",
      );
    }
    if (updated.error === "PAYMENT_REQUIRED") {
      return errorResponse(
        res,
        409,
        "PAYMENT_NOT_VERIFIED",
        "Verify the required payment before confirming this enrollment.",
      );
    }
    if (updated.error === "TERMINAL_STATUS") {
      return errorResponse(
        res,
        409,
        "ENROLLMENT_CANCELLED",
        "A cancelled enrollment cannot be reopened. Create a new booking if needed.",
      );
    }

    return res.json({ data: updated.enrollment });
  } catch (error) {
    console.error("Admin enrollment update failed:", error);
    return errorResponse(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to update this enrollment.",
    );
  }
});

export default router;
