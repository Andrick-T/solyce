import { prisma } from "../db/prisma.js";

export async function requireAdmin(req, res, next) {
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Please sign in to access this resource.",
      },
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return req.session.destroy(() => {
        res.clearCookie("solyce.sid", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });

        return res.status(401).json({
          error: {
            code: "SESSION_INVALID",
            message: "Your session is no longer valid.",
          },
        });
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        error: {
          code: "ADMIN_ACCESS_REQUIRED",
          message: "Administrator access is required.",
        },
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    console.error("Admin authorization failed:", error.message);

    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to authorize this request.",
      },
    });
  }
}
