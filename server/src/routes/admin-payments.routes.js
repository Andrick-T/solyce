import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

router.use(requireAdmin);

const methods = ["MTN_MOMO", "ORANGE_MONEY", "BANK_TRANSFER", "CASH", "OTHER"];

const paymentStatuses = [
  "PENDING",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "REFUNDED",
];

function parseId(value) {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

router.get("/", async (req, res) => {
  const status = req.query.status;

  if (status && status !== "ALL" && !paymentStatuses.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", "Invalid payment status.");
  }

  try {
    const data = await prisma.payment.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      include: {
        enrollment: {
          include: {
            cohort: {
              select: {
                id: true,
                name: true,
                course: { select: { title: true } },
              },
            },
            user: { select: { fullName: true, email: true } },
          },
        },
        verifiedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      data: data.map((payment) => ({
        ...payment,
        student: payment.enrollment.user
          ? {
              fullName: payment.enrollment.user.fullName,
              email: payment.enrollment.user.email,
              phone: null,
            }
          : {
              fullName: payment.enrollment.guestFullName,
              email: payment.enrollment.guestEmail,
              phone: payment.enrollment.guestPhone,
            },
        bookingReference: `SOL-${String(payment.enrollmentId).padStart(6, "0")}`,
      })),
      count: data.length,
    });
  } catch (error) {
    console.error("Admin payment listing failed:", error);
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load payments.");
  }
});

router.patch("/:id", requireSameOrigin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "INVALID_ID", "Invalid payment ID.");

  const parsed = z
    .object({
      method: z.enum(methods),
      receivedAmountXaf: z.number().int().min(0).max(100000000),
      status: z.enum(paymentStatuses),
      transactionReference: z.string().trim().max(191).nullable().optional(),
      verificationNote: z.string().trim().max(5000).nullable().optional(),
    })
    .strict()
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Review the payment details and try again.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  const input = parsed.data;

  if (input.status === "VERIFIED" && input.receivedAmountXaf <= 0) {
    return fail(
      res,
      400,
      "INVALID_RECEIVED_AMOUNT",
      "A verified payment must have a positive received amount.",
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { enrollment: true },
      });

      if (!payment) return { error: "NOT_FOUND" };

      if (payment.status === "REFUNDED") {
        return { error: "REFUNDED" };
      }

      if (
        input.status === "VERIFIED" &&
        payment.enrollment.status === "CANCELLED"
      ) {
        return { error: "ENROLLMENT_CANCELLED" };
      }

      if (
        input.status === "VERIFIED" &&
        input.receivedAmountXaf < payment.expectedAmountXaf
      ) {
        return { error: "AMOUNT_INSUFFICIENT" };
      }

      const isVerified = input.status === "VERIFIED";

      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          method: input.method,
          receivedAmountXaf: input.receivedAmountXaf,
          status: input.status,
          transactionReference: input.transactionReference || null,
          verificationNote: input.verificationNote || null,
          verifiedById: isVerified ? req.admin.id : null,
          verifiedAt: isVerified ? new Date() : null,
        },
      });

      const otherVerifiedPayments = await tx.payment.findMany({
        where: {
          enrollmentId: payment.enrollmentId,
          id: { not: id },
          status: "VERIFIED",
        },
        select: {
          expectedAmountXaf: true,
          receivedAmountXaf: true,
        },
      });

      const hasOtherVerifiedPayment = otherVerifiedPayments.some(
        (otherPayment) =>
          otherPayment.receivedAmountXaf >= otherPayment.expectedAmountXaf,
      );

      const hasValidVerifiedPayment =
        (isVerified &&
          updatedPayment.receivedAmountXaf >=
            updatedPayment.expectedAmountXaf) ||
        hasOtherVerifiedPayment;

      if (hasValidVerifiedPayment) {
        if (payment.enrollment.status !== "CANCELLED") {
          await tx.enrollment.update({
            where: { id: payment.enrollmentId },
            data: {
              status: "CONFIRMED",
              confirmedAt: payment.enrollment.confirmedAt || new Date(),
              cancelledAt: null,
            },
          });
        }
      } else if (payment.enrollment.status === "CONFIRMED") {
        await tx.enrollment.update({
          where: { id: payment.enrollmentId },
          data: {
            status: "PAYMENT_UNDER_REVIEW",
            confirmedAt: null,
          },
        });
      } else if (
        input.status === "REJECTED" ||
        input.status === "UNDER_REVIEW"
      ) {
        if (payment.enrollment.status !== "CANCELLED") {
          await tx.enrollment.update({
            where: { id: payment.enrollmentId },
            data: {
              status: "PAYMENT_UNDER_REVIEW",
              confirmedAt: null,
            },
          });
        }
      }

      return { payment: updatedPayment };
    });

    if (result.error === "NOT_FOUND") {
      return fail(res, 404, "PAYMENT_NOT_FOUND", "Payment not found.");
    }

    if (result.error === "REFUNDED") {
      return fail(
        res,
        409,
        "PAYMENT_REFUNDED",
        "A refunded payment cannot be edited.",
      );
    }

    if (result.error === "ENROLLMENT_CANCELLED") {
      return fail(
        res,
        409,
        "ENROLLMENT_CANCELLED",
        "A payment cannot confirm an enrollment that has been cancelled.",
      );
    }

    if (result.error === "AMOUNT_INSUFFICIENT") {
      return fail(
        res,
        409,
        "AMOUNT_INSUFFICIENT",
        "The received amount is below the required tuition. Record the payment as under review until the balance is settled.",
      );
    }

    return res.json({ data: result.payment });
  } catch (error) {
    console.error("Admin payment update failed:", error);
    return fail(
      res,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to update this payment.",
    );
  }
});

export default router;
