import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireInstructor } from "../middleware/require-instructor.js";
import { instructorLoginLimiter } from "../middleware/auth-rate-limit.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().trim().email().max(191),
  password: z.string().min(1).max(1024),
});

function rejectUnexpectedOrigin(req, res, next) {
  const origin = req.get("origin");
  const allowedOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

  if (!origin || origin !== allowedOrigin) {
    return res.status(403).json({
      error: {
        code: "INVALID_ORIGIN",
        message: "This request origin is not allowed.",
      },
    });
  }

  return next();
}

function regenerateSession(session) {
  return new Promise((resolve, reject) => {
    session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function saveSession(session) {
  return new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// POST /api/instructor/auth/login
router.post(
  "/login",
  instructorLoginLimiter,
  rejectUnexpectedOrigin,
  async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_CREDENTIALS_FORMAT",
          message: "Please provide a valid email and password.",
        },
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
      });

      if (!user || !user.isActive || user.role !== "INSTRUCTOR") {
        return res.status(401).json({
          error: {
            code: "INVALID_LOGIN",
            message: "Invalid email or password.",
          },
        });
      }

      let passwordMatches = false;

      try {
        passwordMatches = await argon2.verify(
          user.passwordHash,
          parsed.data.password,
        );
      } catch {
        // Invalid stored hashes are treated as failed logins.
      }

      if (!passwordMatches) {
        return res.status(401).json({
          error: {
            code: "INVALID_LOGIN",
            message: "Invalid email or password.",
          },
        });
      }

      await regenerateSession(req.session);
      req.session.userId = user.id;
      await saveSession(req.session);

      return res.status(200).json({
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
          },
        },
      });
    } catch (error) {
      console.error("Instructor login failed:", error.message);

      return res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to sign in right now.",
        },
      });
    }
  },
);

// GET /api/instructor/auth/me
router.get("/me", requireInstructor, (req, res) => {
  return res.status(200).json({
    data: { user: req.instructor },
  });
});

// POST /api/instructor/auth/logout
router.post("/logout", rejectUnexpectedOrigin, (req, res) => {
  if (!req.session) {
    return res.sendStatus(204);
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Instructor logout failed:", error.message);

      return res.status(500).json({
        error: {
          code: "LOGOUT_FAILED",
          message: "Unable to sign out right now.",
        },
      });
    }

    res.clearCookie("solyce.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return res.sendStatus(204);
  });
});

export default router;
