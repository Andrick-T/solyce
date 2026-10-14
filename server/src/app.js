import "./config/env.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";

import { prisma } from "./db/prisma.js";
import publicRoutes from "./routes/public.routes.js";
import adminAuthRoutes from "./routes/admin-auth.routes.js";
import adminCoursesRoutes from "./routes/admin-courses.routes.js";
import adminCohortsRoutes from "./routes/admin-cohorts.routes.js";
import adminInstructorsRoutes from "./routes/admin-instructor.routes.js";

const app = express();
const port = Number(process.env.PORT ?? 5000);
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set to a secret of at least 32 characters.",
  );
}

// The default MemoryStore is suitable for local development only.
// Refuse production startup until a persistent session store is configured.
if (isProduction) {
  throw new Error(
    "Production startup is disabled until a persistent session store is configured.",
  );
}

app.disable("x-powered-by");
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json({ limit: "20kb" }));

app.use(
  session({
    name: "solyce.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    },
  }),
);

// Existing public API â€” preserved.
app.use("/api", publicRoutes);

app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/courses", adminCoursesRoutes);
app.use("/api/admin/cohorts", adminCohortsRoutes);
app.use("/api/admin/instructors", adminInstructorsRoutes);
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      api: "running",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "error",
      api: "running",
      database: "unavailable",
    });
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({
    name: "Solyce API",
    status: "running",
  });
});

const server = app.listen(port, () => {
  console.log(`Solyce API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
