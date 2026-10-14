import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../middleware/require-admin.js";

const router = Router();

// Only active instructor accounts can be assigned to live cohorts.
router.get("/", requireAdmin, async (_req, res) => {
  try {
    const data = await prisma.user.findMany({
      where: { role: "INSTRUCTOR", isActive: true },
      select: { id: true, fullName: true, email: true },
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

export default router;
