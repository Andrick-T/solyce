import { Router } from "express";
import argon2 from "argon2";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();

// List active instructors available for cohort assignment.
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const data = await prisma.user.findMany({
      where: { role: "INSTRUCTOR", isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: "asc" },
    });

    return res.status(200).json({ data, count: data.length });
  } catch (error) {
    console.error("Admin instructor listing failed:", error.message);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to load instructors.",
      },
    });
  }
});

// Create an active instructor account.
router.post("/", requireSameOrigin, requireAdmin, async (req, res) => {
  const fullName =
    typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";

  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (fullName.length < 2 || fullName.length > 120) {
    return res.status(400).json({
      error: {
        code: "INVALID_FULL_NAME",
        message: "Full name must contain between 2 and 120 characters.",
      },
    });
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: {
        code: "INVALID_EMAIL",
        message: "Enter a valid email address.",
      },
    });
  }

  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({
      error: {
        code: "INVALID_PASSWORD",
        message: "Password must contain between 12 and 128 characters.",
      },
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email address already exists.",
        },
      });
    }

    const passwordHash = await argon2.hash(password);

    const instructor = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "INSTRUCTOR",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ data: instructor });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "An account with this email address already exists.",
        },
      });
    }

    console.error("Admin instructor creation failed:", error.message);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create the instructor account.",
      },
    });
  }
});

export default router;
