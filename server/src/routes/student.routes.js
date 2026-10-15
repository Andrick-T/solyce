import { Router } from "express";
import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireStudent } from "../middleware/require-student.js";
import { requireSameOrigin } from "../middleware/require-same-origin.js";

const router = Router();
const publicUserSelect = { id: true, email: true, fullName: true, role: true, createdAt: true };
const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(191),
  password: z.string().min(10).max(128),
}).strict();
const loginSchema = z.object({
  email: z.string().trim().email().max(191),
  password: z.string().min(1).max(128),
}).strict();
const profileSchema = z.object({ fullName: z.string().trim().min(2).max(150) }).strict();

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}
function saveSession(session) {
  return new Promise((resolve, reject) => session.save((error) => error ? reject(error) : resolve()));
}
function regenerateSession(session) {
  return new Promise((resolve, reject) => session.regenerate((error) => error ? reject(error) : resolve()));
}
function destroySession(req, res, status = 401, code = "SESSION_INVALID", message = "Your session is no longer valid.") {
  const clear = () => res.clearCookie("solyce.sid", {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
  }).status(status).json({ error: { code, message } });
  if (!req.session) return clear();
  req.session.destroy((error) => {
    if (error) console.error("Student session cleanup failed:", error.message);
    return clear();
  });
}
function normalizedName(value) { return value.trim().replace(/\s+/g, " "); }

router.post("/auth/register", requireSameOrigin, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Provide a name, valid email, and password of 10â€“128 characters.");
  const fullName = normalizedName(parsed.data.fullName);
  if (fullName.length < 2) return fail(res, 400, "VALIDATION_ERROR", "Please provide your full name.");
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return fail(res, 409, "ACCOUNT_EXISTS", "Unable to create an account with those details.");
    const passwordHash = await argon2.hash(parsed.data.password);
    const user = await prisma.user.create({
      data: { fullName, email, passwordHash, role: "STUDENT", isActive: true },
      select: publicUserSelect,
    });
    await regenerateSession(req.session);
    req.session.userId = user.id;
    await saveSession(req.session);
    return res.status(201).json({ data: { user } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(res, 409, "ACCOUNT_EXISTS", "Unable to create an account with those details.");
    }
    console.error("Student registration failed:", error.message);
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to create your account right now.");
  }
});

router.post("/auth/login", requireSameOrigin, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Please provide a valid email and password.");
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    let passwordMatches = false;
    if (user && user.role === "STUDENT" && user.isActive) {
      try { passwordMatches = await argon2.verify(user.passwordHash, parsed.data.password); } catch { passwordMatches = false; }
    }
    if (!user || user.role !== "STUDENT" || !user.isActive || !passwordMatches) {
      return fail(res, 401, "INVALID_LOGIN", "Invalid email or password.");
    }
    await regenerateSession(req.session);
    req.session.userId = user.id;
    await saveSession(req.session);
    return res.status(200).json({ data: { user: {
      id: user.id, email: user.email, fullName: user.fullName, role: user.role, createdAt: user.createdAt,
    } } });
  } catch (error) {
    console.error("Student login failed:", error.message);
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to sign in right now.");
  }
});

router.get("/auth/me", requireStudent, (req, res) => res.json({ data: { user: req.student } }));

router.post("/auth/logout", requireSameOrigin, (req, res) => {
  if (!req.session) {
    res.clearCookie("solyce.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return res.sendStatus(204);
  }
  req.session.destroy((error) => {
    if (error) {
      console.error("Student logout failed:", error.message);
      return fail(res, 500, "LOGOUT_FAILED", "Unable to sign out right now.");
    }
    res.clearCookie("solyce.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
    return res.sendStatus(204);
  });
});

router.get("/enrollments", requireStudent, async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.student.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, status: true, agreedPriceXaf: true, enrolledAt: true, confirmedAt: true, createdAt: true,
        cohort: {
          select: {
            id: true, name: true, startDate: true, endDate: true, scheduleDescription: true, timezone: true, status: true,
            course: { select: { title: true, slug: true, language: true, examType: true, durationWeeks: true } },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, expectedAmountXaf: true, receivedAmountXaf: true, method: true, status: true,
            transactionReference: true, verifiedAt: true, createdAt: true, updatedAt: true,
          },
        },
      },
    });
    return res.json({ data: enrollments });
  } catch (error) {
    console.error("Student enrolment listing failed:", error.message);
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to load your enrolments right now.");
  }
});

router.patch("/profile", requireSameOrigin, requireStudent, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Provide a valid full name.");
  const fullName = normalizedName(parsed.data.fullName);
  if (fullName.length < 2) return fail(res, 400, "VALIDATION_ERROR", "Please provide your full name.");
  try {
    const user = await prisma.user.update({
      where: { id: req.student.id },
      data: { fullName },
      select: publicUserSelect,
    });
    return res.json({ data: { user } });
  } catch (error) {
    console.error("Student profile update failed:", error.message);
    return fail(res, 500, "INTERNAL_SERVER_ERROR", "Unable to update your profile right now.");
  }
});

export default router;