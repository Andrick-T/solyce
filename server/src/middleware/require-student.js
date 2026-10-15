import { prisma } from "../db/prisma.js";

function clearSessionCookie(res) {
  res.clearCookie("solyce.sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function requireStudent(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: { code: "AUTHENTICATION_REQUIRED", message: "Please sign in to access this resource." } });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    if (!user || !user.isActive || user.role !== "STUDENT") {
      return req.session.destroy((error) => {
        if (error) console.error("Invalid student session cleanup failed:", error.message);
        clearSessionCookie(res);
        return res.status(401).json({ error: { code: "SESSION_INVALID", message: "Your session is no longer valid." } });
      });
    }
    const { isActive, ...safeUser } = user;
    req.student = safeUser;
    return next();
  } catch (error) {
    console.error("Student authorization failed:", error.message);
    return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unable to authorize this request." } });
  }
}