import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

const router = Router();

const bookingSchema = z
  .object({
    cohortId: z.number().int().positive(),
    fullName: z.string().trim().min(2).max(150),
    email: z.string().trim().email().max(191),
    phone: z.string().trim().min(6).max(40),
  })
  .strict();

const activeStatuses = {
  notIn: ["CANCELLED", "WAITLISTED"],
};

function publicError(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

router.post("/", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Please check your name, email, phone number and selected cohort.",
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
  }

  const input = {
    ...parsed.data,
    fullName: parsed.data.fullName.replace(/\s+/g, " "),
    email: parsed.data.email.toLowerCase(),
    phone: parsed.data.phone.trim(),
  };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const cohort = await tx.cohort.findFirst({
          where: {
            id: input.cohortId,
            status: "OPEN",
            startDate: { gte: new Date(new Date().toISOString().slice(0, 10)) },
            course: { isPublished: true },
            OR: [
              { enrollmentDeadline: null },
              { enrollmentDeadline: { gte: new Date() } },
            ],
          },
          include: {
            course: {
              select: {
                title: true,
                priceXaf: true,
                isPublished: true,
              },
            },
          },
        });

        if (!cohort) {
          return {
            error: {
              status: 409,
              code: "COHORT_UNAVAILABLE",
              message:
                "This cohort is no longer open for booking. Please choose another cohort.",
            },
          };
        }

        const duplicate = await tx.enrollment.findFirst({
          where: {
            cohortId: cohort.id,
            guestEmail: input.email,
            status: { not: "CANCELLED" },
          },
          select: { id: true },
        });

        if (duplicate) {
          return {
            error: {
              status: 409,
              code: "DUPLICATE_BOOKING",
              message:
                "A booking already exists for this email address and cohort. Please contact Solyce if you need help.",
            },
          };
        }

        const occupied = await tx.enrollment.count({
          where: {
            cohortId: cohort.id,
            status: activeStatuses,
          },
        });

        if (occupied >= cohort.capacity) {
          return {
            error: {
              status: 409,
              code: "COHORT_FULL",
              message:
                "This cohort has no places remaining. Please choose another cohort.",
            },
          };
        }

        const price = cohort.priceXaf ?? cohort.course.priceXaf;

        const enrollment = await tx.enrollment.create({
          data: {
            userId: null,
            guestFullName: input.fullName,
            guestEmail: input.email,
            guestPhone: input.phone,
            cohortId: cohort.id,
            status: "PENDING",
            agreedPriceXaf: price,
            payments: {
              create: {
                expectedAmountXaf: price,
                receivedAmountXaf: 0,
                method: "OTHER",
                status: "PENDING",
              },
            },
          },
          select: {
            id: true,
            status: true,
            agreedPriceXaf: true,
            createdAt: true,
            cohort: {
              select: {
                name: true,
                startDate: true,
                course: { select: { title: true } },
              },
            },
          },
        });

        return { enrollment };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      },
    );

    if (result.error) {
      return publicError(
        res,
        result.error.status,
        result.error.code,
        result.error.message,
      );
    }

    return res.status(201).json({
      data: {
        bookingReference: `SOL-${String(result.enrollment.id).padStart(6, "0")}`,
        enrollmentId: result.enrollment.id,
        status: result.enrollment.status,
        amountDueXaf: result.enrollment.agreedPriceXaf,
        cohort: result.enrollment.cohort,
        createdAt: result.enrollment.createdAt,
        message:
          "Your booking has been received. Your place is not confirmed until Solyce verifies your offline payment.",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2034")
    ) {
      return publicError(
        res,
        409,
        "BOOKING_CONFLICT",
        "This booking could not be completed because the cohort changed or a duplicate was detected. Please refresh and try again.",
      );
    }

    console.error("Guest booking failed:", error);

    return publicError(
      res,
      500,
      "BOOKING_FAILED",
      "We could not complete your booking right now. Please try again later.",
    );
  }
});

export default router;
