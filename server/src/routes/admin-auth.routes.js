import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";
import { adminLoginLimiter } from "../middleware/auth-rate-limit.js";

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

  next();
}

function saveSession(session) {
  return new Promise((resolve, reject) => {
    session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function regenerateSession(session) {
  return new Promise((resolve, reject) => {
    session.regenerate((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// POST /api/admin/auth/login
router.post(
  "/login",
  adminLoginLimiter,
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

    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password;

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.isActive || user.role !== "ADMIN") {
        return res.status(401).json({
          error: {
            code: "INVALID_LOGIN",
            message: "Invalid email or password.",
          },
        });
      }

      let passwordMatches = false;

      try {
        passwordMatches = await argon2.verify(user.passwordHash, password);
      } catch {
        // Treat malformed or unsupported stored hashes as failed login.
      }

      if (!passwordMatches) {
        return res.status(401).json({
          error: {
            code: "INVALID_LOGIN",
            message: "Invalid email or password.",
          },
        });
      }

      // Replace the session ID after authentication to prevent
      // session fixation.
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
      console.error("Admin login failed:", error.message);

      return res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to sign in right now.",
        },
      });
    }
  },
);

// GET /api/admin/auth/me
router.get("/me", requireAdmin, (req, res) => {
  return res.status(200).json({
    data: {
      user: {
        id: req.admin.id,
        email: req.admin.email,
        fullName: req.admin.fullName,
        role: req.admin.role,
      },
    },
  });
});

// POST /api/admin/auth/logout
router.post("/logout", rejectUnexpectedOrigin, (req, res) => {
  if (!req.session) {
    return res.sendStatus(204);
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Admin logout failed:", error.message);

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
