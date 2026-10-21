import { Router } from "express";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "../db/prisma.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";
import { sendPasswordResetEmail } from "../services/email.js";

import { rateLimit } from "express-rate-limit";

const router = Router();

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "PASSWORD_RESET_RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
  },
});

const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "PASSWORD_RESET_RATE_LIMITED",
      message: "Too many attempts. Please try again later.",
    },
  },
});

const requestSchema = z
  .object({
    email: z.string().trim().email().max(191),
  })
  .strict();

const confirmSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/i),
    password: z.string().min(10).max(128),
  })
  .strict();

const genericResponse = {
  message:
    "If an eligible account exists for that email, a password reset link will be sent.",
};

function fail(res, status, code, message) {
  return res.status(status).json({
    error: { code, message },
  });
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

router.post("/", requestLimiter, requireSameOrigin, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "Please provide a valid email address.",
    );
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: {
        email,
        role: "STUDENT",
        isActive: true,
      },
      select: {
        id: true,
        email: true,
      },
    });

    // Always return the same response for unknown and ineligible accounts.
    if (!user) {
      return res.status(200).json({ data: genericResponse });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Invalidate any outstanding reset links for this user.
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });
    });

    const clientOrigin = process.env.CLIENT_ORIGIN;

    if (!clientOrigin) {
      throw new Error("CLIENT_ORIGIN is not configured.");
    }

    const resetUrl = new URL("/student/reset-password", clientOrigin);
    resetUrl.searchParams.set("token", rawToken);

    await sendPasswordResetEmail({
      to: user.email,
      resetUrl: resetUrl.toString(),
    });

    return res.status(200).json({ data: genericResponse });
  } catch (error) {
    console.error("Student password reset request failed:", error.message);

    return fail(
      res,
      500,
      "PASSWORD_RESET_FAILED",
      "Unable to process the request right now. Please try again later.",
    );
  }
});

router.post("/confirm", confirmLimiter, requireSameOrigin, async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);

  if (!parsed.success) {
    return fail(
      res,
      400,
      "VALIDATION_ERROR",
      "The reset link or new password is invalid.",
    );
  }

  const tokenHash = hashToken(parsed.data.token);
  const now = new Date();

  try {
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
        user: {
          role: "STUDENT",
          isActive: true,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!tokenRecord) {
      return fail(
        res,
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "This reset link is invalid or has expired. Please request a new one.",
      );
    }

    const passwordHash = await argon2.hash(parsed.data.password);

    const consumed = await prisma.$transaction(async (tx) => {
      const result = await tx.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (result.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: {
          id: tokenRecord.userId,
        },
        data: {
          passwordHash,
        },
      });

      // Invalidate any other outstanding reset links for this user.
      await tx.passwordResetToken.updateMany({
        where: {
          userId: tokenRecord.userId,
          id: { not: tokenRecord.id },
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      return true;
    });

    if (!consumed) {
      return fail(
        res,
        400,
        "INVALID_OR_EXPIRED_TOKEN",
        "This reset link is invalid or has expired. Please request a new one.",
      );
    }

    return res.status(200).json({
      data: {
        message:
          "Your password has been reset. You can now sign in with your new password.",
      },
    });
  } catch (error) {
    console.error("Student password reset confirmation failed:", error.message);

    return fail(
      res,
      500,
      "PASSWORD_RESET_FAILED",
      "Unable to reset your password right now. Please try again later.",
    );
  }
});

export default router;
