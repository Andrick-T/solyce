[CmdletBinding()]
param(
  [switch]$WhatIf
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Stop-Preflight([string]$Message) {
  throw "PRE-FLIGHT FAILED: $Message`nNo project files were modified. Review the message, reconcile the local source, and run again."
}
function Read-Utf8([string]$Path) {
  return [System.IO.File]::ReadAllText((Join-Path $ProjectRoot $Path), [System.Text.Encoding]::UTF8)
}
function Write-Utf8([string]$Path, [string]$Content) {
  $full = Join-Path $ProjectRoot $Path
  $parent = Split-Path -Parent $full
  if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
}
function Backup-File([string]$RelativePath) {
  $source = Join-Path $ProjectRoot $RelativePath
  if (Test-Path $source) {
    $destination = Join-Path $BackupRoot $RelativePath
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
    $script:BackedUpFiles.Add($RelativePath)
  }
}
function Assert-Contains([string]$Content, [string]$Needle, [string]$Description) {
  if (!$Content.Contains($Needle)) { Stop-Preflight "Expected source marker not found ($Description). Local files may have changed since this script was prepared." }
}

$ProjectRoot = (Get-Location).Path
$requiredFiles = @(
  "server/prisma/schema.prisma", "server/package.json", "server/src/app.js",
  "server/src/db/prisma.js", "server/src/config/env.js",
  "server/src/routes/admin-auth.routes.js", "server/src/middleware/require-admin.js",
  "server/src/middleware/require-same-origin.js", "server/src/routes/public-bookings.routes.js",
  "server/src/routes/admin-enrollments.routes.js", "server/src/routes/admin-payments.routes.js",
  "client/package.json", "client/src/main.jsx", "client/src/student/StudentApp.jsx",
  "client/src/student/StudentApp.css"
)
foreach ($f in $requiredFiles) {
  if (!(Test-Path (Join-Path $ProjectRoot $f) -PathType Leaf)) { Stop-Preflight "Missing required file: $f. Run from the Solyce repository root." }
}
if (!(Test-Path (Join-Path $ProjectRoot ".git") -PathType Container) -and !(Test-Path (Join-Path $ProjectRoot ".git") -PathType Leaf)) {
  Stop-Preflight "The current directory does not look like the Solyce Git repository root (.git was not found)."
}

$schema = Read-Utf8 "server/prisma/schema.prisma"
$serverPackage = Read-Utf8 "server/package.json"
$app = Read-Utf8 "server/src/app.js"
$adminAuth = Read-Utf8 "server/src/routes/admin-auth.routes.js"
$adminMiddleware = Read-Utf8 "server/src/middleware/require-admin.js"
$sameOrigin = Read-Utf8 "server/src/middleware/require-same-origin.js"
$studentApp = Read-Utf8 "client/src/student/StudentApp.jsx"
$clientPackage = Read-Utf8 "client/package.json"
$mainJsx = Read-Utf8 "client/src/main.jsx"

foreach ($marker in @('model User {','passwordHash String','role         UserRole','isActive     Boolean','model Enrollment {','userId         Int?','agreedPriceXaf Int','payments Payment[]','model Payment {','model Cohort {','model Course {')) {
  Assert-Contains $schema $marker "Prisma schema marker: $marker"
}
foreach ($marker in @('"argon2"', '"express-session"', '"zod"', '"@prisma/client"')) {
  Assert-Contains $serverPackage $marker "server dependency: $marker"
}
foreach ($marker in @('app.use(express.json','session({','name: "solyce.sid"','app.use("/api/admin/auth", adminAuthRoutes);','app.use("/api/admin/payments", adminPaymentsRoutes);')) {
  Assert-Contains $app $marker "Express app marker: $marker"
}
Assert-Contains $adminAuth 'argon2.verify(user.passwordHash, password)' "existing Argon2 convention"
Assert-Contains $adminAuth 'req.session.userId = user.id' "existing session convention"
Assert-Contains $adminMiddleware 'where: { id: userId }' "admin middleware Prisma convention"
Assert-Contains $sameOrigin 'export function requireSameOrigin' "same-origin middleware export"
Assert-Contains $mainJsx 'from "./student/StudentApp.jsx"' "student app entry import"
Assert-Contains $studentApp 'const navigation = [' "Phase 1 student navigation"
Assert-Contains $clientPackage '"build": "vite build"' "client build script"

$newFiles = @("server/src/routes/student.routes.js", "server/src/middleware/require-student.js")
foreach ($f in $newFiles) {
  if (Test-Path (Join-Path $ProjectRoot $f)) { Stop-Preflight "Unexpected existing file: $f. Inspect it manually; this script will not overwrite existing work." }
}
if ($app.Contains('studentRoutes') -or $app.Contains('"/api/student"')) {
  Stop-Preflight "A student router may already be mounted in server/src/app.js. Inspect and integrate manually to avoid duplicate routes."
}
if ($studentApp.Contains('student-phase2-auth')) {
  Stop-Preflight "The student frontend appears to contain a Phase 2 marker already. Inspect existing work before rerunning."
}
if ($WhatIf) {
  Write-Host "Preflight passed. -WhatIf requested: no files were changed."
  exit 0
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot ".solyce-backups/student-space-phase2-$stamp"
if (Test-Path $BackupRoot) { Stop-Preflight "Backup directory already exists: $BackupRoot" }
$BackedUpFiles = [System.Collections.Generic.List[string]]::new()
$CreatedFiles = [System.Collections.Generic.List[string]]::new()
$ModifiedFiles = [System.Collections.Generic.List[string]]::new()
$installationStarted = $false

$routeContent = @'
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
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", "Provide a name, valid email, and password of 10–128 characters.");
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
'@

$middlewareContent = @'
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
'@

$frontendContent = @'
import { useCallback, useEffect, useMemo, useState } from "react";
import "./StudentApp.css";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "▦", group: "LEARNING" },
  { id: "courses", label: "My learning", icon: "▤", group: "LEARNING" },
  { id: "schedule", label: "My schedule", icon: "▦", group: "LEARNING" },
  { id: "assignments", label: "Assignments & assessments", icon: "✓", group: "LEARNING" },
  { id: "resources", label: "Resources", icon: "▧", group: "LEARNING" },
  { id: "payments", label: "Payments", icon: "◇", group: "ACCOUNT" },
  { id: "profile", label: "My profile", icon: "○", group: "ACCOUNT" },
  { id: "support", label: "Help & support", icon: "?", group: "ACCOUNT" },
];
const pageCopy = {
  courses: { eyebrow: "YOUR LEARNING PATH", title: "My learning", description: "Your enrolments and program details." },
  schedule: { eyebrow: "PLAN AHEAD", title: "My schedule", description: "Your cohort dates and class schedule details." },
  assignments: { eyebrow: "PRACTICE & FEEDBACK", title: "Assignments & assessments", description: "Assignment tools are not available in this phase." },
  resources: { eyebrow: "YOUR LEARNING LIBRARY", title: "Resources", description: "Learning resources will appear here when supported by the platform." },
  payments: { eyebrow: "ACCOUNT OVERVIEW", title: "Payments", description: "Payment history associated with your linked enrolments." },
  profile: { eyebrow: "YOUR ACCOUNT", title: "My profile", description: "Update the name on your student account." },
  support: { eyebrow: "WE ARE HERE TO HELP", title: "Help & support", description: "Get help with an existing or previous Solyce booking." },
};
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api/student${path}`, {
    credentials: "include",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "Something went wrong. Please try again.");
  return body?.data;
}
function StudentBrand() {
  return <a className="student-brand" href="/student" aria-label="Solyce student home"><span className="student-brand-mark">S.</span><span>solyce<span className="student-brand-period">.</span></span></a>;
}
function EmptyState({ title, children }) {
  return <div className="student-empty"><div className="student-empty-icon">✳</div><h3>{title}</h3><p>{children}</p></div>;
}
function money(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value || 0)) + " XAF";
}
function date(value) {
  if (!value) return "Not specified";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Not specified" : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(d);
}
function statusLabel(value) { return String(value || "UNKNOWN").replaceAll("_", " ").toLowerCase().replace(/^\w/, c => c.toUpperCase()); }

export default function StudentApp() {
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [auth, setAuth] = useState({ fullName: "", email: "", password: "" });
  const [user, setUser] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const currentPage = pageCopy[activePage];

  const loadEnrollments = useCallback(async () => {
    setDataLoading(true);
    try {
      const result = await api("/enrollments");
      setEnrollments(Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : []);
      setError("");
    } catch (e) { setError(e.message); }
    finally { setDataLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    api("/auth/me").then(({ user: current }) => {
      if (!alive) return;
      setUser(current);
      setProfileName(current.fullName || "");
      return api("/enrollments").then(result => {
        if (alive) setEnrollments(Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : []);
      });
    }).catch((e) => {
      if (alive && !/sign in|session|authentication/i.test(e.message)) setError(e.message);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const paymentRows = useMemo(() => enrollments.flatMap(enrollment =>
    (enrollment.payments || []).map(payment => ({ ...payment, enrollment }))
  ), [enrollments]);

  function navigate(id) {
    setActivePage(id); setMobileNavOpen(false); setNotice(""); setError("");
    window.history.replaceState({}, "", id === "dashboard" ? "/student" : `/student/${id}`);
  }
  async function submitAuth(event) {
    event.preventDefault(); setAuthBusy(true); setError(""); setNotice("");
    try {
      const payload = authMode === "register"
        ? { fullName: auth.fullName, email: auth.email, password: auth.password }
        : { email: auth.email, password: auth.password };
      const result = await api(`/auth/${authMode === "register" ? "register" : "login"}`, { method: "POST", body: JSON.stringify(payload) });
      setUser(result.user); setProfileName(result.user.fullName || ""); setAuth({ fullName: "", email: "", password: "" });
      setEnrollments([]); await loadEnrollments(); setNotice("You are signed in.");
    } catch (e) { setError(e.message); }
    finally { setAuthBusy(false); }
  }
  async function signOut() {
    setError(""); setNotice("");
    try { await api("/auth/logout", { method: "POST" }); }
    catch (e) { setError(e.message); return; }
    setUser(null); setEnrollments([]); setAuth({ fullName: "", email: "", password: "" }); setAuthMode("login");
  }
  async function saveProfile(event) {
    event.preventDefault(); setProfileBusy(true); setError(""); setNotice("");
    try {
      const result = await api("/profile", { method: "PATCH", body: JSON.stringify({ fullName: profileName }) });
      setUser(result.user); setProfileName(result.user.fullName); setNotice("Your profile was updated.");
    } catch (e) { setError(e.message); }
    finally { setProfileBusy(false); }
  }

  if (loading) return <div className="student-auth-screen"><div className="student-auth-card"><StudentBrand /><p>Checking your student session…</p></div></div>;
  if (!user) return <div className="student-auth-screen"><div className="student-auth-card">
    <StudentBrand /><p className="student-eyebrow"><span /> YOUR LEARNING SPACE</p>
    <h1>{authMode === "login" ? "Welcome back." : "Start your journey."}</h1>
    <p className="student-auth-intro">{authMode === "login" ? "Sign in to access your Solyce student account." : "Create a student account to manage your learning."}</p>
    {error && <div className="student-alert" role="alert">{error}</div>}
    <form onSubmit={submitAuth} className="student-auth-form">
      {authMode === "register" && <label>Full name<input autoComplete="name" required minLength="2" maxLength="150" value={auth.fullName} onChange={e => setAuth({ ...auth, fullName: e.target.value })} /></label>}
      <label>Email address<input type="email" autoComplete="email" required maxLength="191" value={auth.email} onChange={e => setAuth({ ...auth, email: e.target.value })} /></label>
      <label>Password<input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required minLength={authMode === "register" ? 10 : 1} maxLength="128" value={auth.password} onChange={e => setAuth({ ...auth, password: e.target.value })} />{authMode === "register" && <small>Use at least 10 characters.</small>}</label>
      <button className="student-primary-button" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"} <span>→</span></button>
    </form>
    <p className="student-auth-switch">{authMode === "login" ? "New to Solyce?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }} type="button">{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
    <a className="student-back-link" href="/">← Back to Solyce website</a>
  </div></div>;

  const activeCount = enrollments.filter(e => ["CONFIRMED", "AWAITING_PAYMENT", "PAYMENT_UNDER_REVIEW"].includes(e.status)).length;
  const currentLetter = (user.fullName || "S").trim().charAt(0).toUpperCase() || "S";
  const refreshButton = <button type="button" className="student-inline-link" onClick={loadEnrollments} disabled={dataLoading}>{dataLoading ? "Refreshing…" : "Refresh ↻"}</button>;

  return <div className="student-app student-phase2-auth">
    <aside className={`student-sidebar${mobileNavOpen ? " is-open" : ""}`}>
      <div className="student-sidebar-top"><StudentBrand /><button className="student-mobile-close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">×</button></div>
      <div className="student-profile-mini"><div className="student-avatar">{currentLetter}</div><div><strong>{user.fullName}</strong><span>Student account</span></div></div>
      <nav className="student-navigation" aria-label="Student navigation">
        {["LEARNING", "ACCOUNT"].map(group => <div className="student-nav-group" key={group}><p>{group}</p>{navigation.filter(item => item.group === group).map(item => <button key={item.id} type="button" className={`student-nav-item${activePage === item.id ? " active" : ""}`} onClick={() => navigate(item.id)}><span className="student-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span></button>)}</div>)}
      </nav>
      <div className="student-sidebar-bottom"><div className="student-help-card"><span className="student-help-symbol">?</span><strong>Need a hand?</strong><p>Have a question about an enrolment or an earlier guest booking?</p><button type="button" onClick={() => navigate("support")}>Visit support <span>↗</span></button></div><button type="button" className="student-signout" onClick={signOut}><span>↪</span> Sign out</button></div>
    </aside>
    {mobileNavOpen && <button className="student-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
    <main className="student-main">
      <header className="student-topbar"><button className="student-menu-toggle" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">☰</button><div className="student-breadcrumb">Student portal <span>/</span> <strong>{activePage === "dashboard" ? "Dashboard" : navigation.find(item => item.id === activePage)?.label}</strong></div><div className="student-top-actions"><span className="student-date-label">YOUR LEARNING SPACE</span><div className="student-top-avatar">{currentLetter}</div></div></header>
      <div className="student-content">
        {error && <div className="student-alert student-alert-wide" role="alert">{error} <button type="button" onClick={() => setError("")}>Dismiss</button></div>}
        {notice && <div className="student-notice" role="status">{notice}</div>}
        {activePage === "dashboard" ? <>
          <section className="student-welcome"><div><p className="student-eyebrow"><span /> YOUR NEXT CHAPTER</p><h1>Make progress,<br /><em>one step at a time.</em></h1><p className="student-welcome-copy">Welcome, {user.fullName}. Your student space shows information linked to your account.</p><div className="student-welcome-actions"><button type="button" className="student-primary-button" onClick={() => navigate("courses")}>Explore my learning <span>↗</span></button><button type="button" className="student-text-button" onClick={() => navigate("payments")}>View payments <span>→</span></button></div></div><div className="student-welcome-art"><div className="student-art-ring ring-one"/><div className="student-art-ring ring-two"/><div className="student-art-core">S<span>.</span></div><span className="student-art-label art-label-one">01 / CLARITY</span><span className="student-art-label art-label-two">02 / PRACTICE</span><span className="student-art-label art-label-three">03 / PROGRESS</span><span className="student-art-cross">+</span></div></section>
          <section className="student-stat-grid" aria-label="Learning overview"><article className="student-stat-card"><div className="student-stat-top"><span>LINKED ENROLMENTS</span><span className="student-stat-icon">▤</span></div><strong>{enrollments.length}</strong><p>Records connected to your account</p></article><article className="student-stat-card"><div className="student-stat-top"><span>ACTIVE PROGRAMS</span><span className="student-stat-icon">↗</span></div><strong>{activeCount}</strong><p>Enrolments not cancelled or waitlisted</p></article><article className="student-stat-card"><div className="student-stat-top"><span>PAYMENT RECORDS</span><span className="student-stat-icon">◇</span></div><strong>{paymentRows.length}</strong><p>Actual records from linked enrolments</p></article><article className="student-stat-card"><div className="student-stat-top"><span>TO-DO</span><span className="student-stat-icon">✓</span></div><strong>—</strong><p>Assignment tools are not available yet</p></article></section>
          <section className="student-dashboard-grid"><div className="student-panel student-program-panel"><div className="student-panel-heading"><div><p className="student-eyebrow">YOUR JOURNEY</p><h2>Your enrolments</h2></div>{refreshButton}</div>{dataLoading ? <EmptyState title="Loading your records">Please wait while your enrolments are refreshed.</EmptyState> : enrollments.length ? enrollments.slice(0, 4).map(e => <div className="student-record" key={e.id}><div><strong>{e.cohort?.course?.title || e.cohort?.name || "Solyce program"}</strong><span>{e.cohort?.name} · {statusLabel(e.status)}</span></div><b>{money(e.agreedPriceXaf)}</b></div>) : <EmptyState title="No linked enrolments yet">Only enrolments securely linked to your account appear here. If you previously booked as a guest, contact the Solyce team to request assistance. A matching email or booking reference alone does not automatically link a booking.</EmptyState>}</div><div className="student-panel student-agenda-panel"><div className="student-panel-heading"><div><p className="student-eyebrow">KEEP ON TRACK</p><h2>Next cohort dates</h2></div>{refreshButton}</div>{enrollments.length ? enrollments.slice(0, 4).map(e => <div className="student-record compact" key={e.id}><div><strong>{e.cohort?.name || "Cohort"}</strong><span>{date(e.cohort?.startDate)} – {date(e.cohort?.endDate)}</span></div><b>{statusLabel(e.cohort?.status)}</b></div>) : <EmptyState title="Nothing scheduled yet">Your cohort dates will appear when a linked enrolment exists. Live session scheduling is not yet available.</EmptyState>}</div></section>
          <section className="student-bottom-grid"><div className="student-tip-card"><div className="student-tip-mark">✳</div><div><p className="student-eyebrow">THE SOLYCE METHOD</p><h2>Small, consistent steps<br />create meaningful progress.</h2><p>Return regularly, practise deliberately and keep your learning goals in sight.</p></div><span className="student-tip-index">01 — 03</span></div><div className="student-panel student-quick-panel"><p className="student-eyebrow">QUICK ACCESS</p><button type="button" onClick={() => navigate("courses")}><span>▧</span> My enrolments <b>→</b></button><button type="button" onClick={() => navigate("payments")}><span>◇</span> Payment details <b>→</b></button><button type="button" onClick={() => navigate("profile")}><span>○</span> My profile <b>→</b></button></div></section>
        </> : <><div className="student-page-heading"><p className="student-eyebrow"><span /> {currentPage.eyebrow}</p><h1>{currentPage.title}</h1><p>{currentPage.description}</p></div>
          {activePage === "profile" ? <div className="student-panel student-profile-notice"><div className="student-avatar large">{currentLetter}</div><form className="student-profile-form" onSubmit={saveProfile}><h2>Your student profile</h2><label>Full name<input required minLength="2" maxLength="150" value={profileName} onChange={e => setProfileName(e.target.value)} /></label><p>Email: {user.email} (email changes are not available here)</p><button className="student-primary-button" disabled={profileBusy}>{profileBusy ? "Saving…" : "Save profile"} <span>→</span></button></form></div>
          : activePage === "courses" ? <div className="student-panel student-subpage-panel">{enrollments.length ? enrollments.map(e => <div className="student-record" key={e.id}><div><strong>{e.cohort?.course?.title || "Course"}</strong><span>{e.cohort?.name} · {e.cohort?.course?.language || ""} · {statusLabel(e.status)}</span><small>{date(e.cohort?.startDate)} – {date(e.cohort?.endDate)} · {e.cohort?.scheduleDescription}</small></div><b>{money(e.agreedPriceXaf)}</b></div>) : <EmptyState title="Your programs will appear here">There are no enrolments linked to this account yet. Previous guest bookings require assistance from the Solyce team.</EmptyState>}</div>
          : activePage === "schedule" ? <div className="student-panel student-subpage-panel">{enrollments.length ? enrollments.map(e => <div className="student-record" key={e.id}><div><strong>{e.cohort?.name || "Cohort"}</strong><span>{e.cohort?.course?.title || "Course"} · {e.cohort?.timezone || "Africa/Douala"}</span><small>{date(e.cohort?.startDate)} – {date(e.cohort?.endDate)} · {e.cohort?.scheduleDescription || "Schedule not specified"} · {statusLabel(e.cohort?.status)}</small></div></div>) : <EmptyState title="Your schedule is taking shape">Cohort dates appear here when linked enrolments exist. Live meeting links and individual session times are not provided by the current data model.</EmptyState>}</div>
          : activePage === "payments" ? <div className="student-panel student-subpage-panel">{paymentRows.length ? paymentRows.map(p => <div className="student-record" key={p.id}><div><strong>{p.enrollment?.cohort?.course?.title || p.enrollment?.cohort?.name || "Enrolment payment"}</strong><span>{statusLabel(p.status)} · {statusLabel(p.method)} · Expected {money(p.expectedAmountXaf)}</span><small>Received: {money(p.receivedAmountXaf)} · Reference: {p.transactionReference || "Not provided"} · Recorded {date(p.createdAt)}</small></div><b>{money(p.receivedAmountXaf)}</b></div>) : <EmptyState title="No payment records yet">Payment history is shown only for enrolments linked to your account.</EmptyState>}</div>
          : activePage === "support" ? <div className="student-panel student-subpage-panel"><EmptyState title="Contact the Solyce team">If you booked as a guest before creating your account, contact Solyce directly through the contact details on the public website. The platform does not automatically claim guest bookings based on email or booking reference.</EmptyState></div>
          : <div className="student-panel student-subpage-panel"><EmptyState title={activePage === "assignments" ? "Assignment tools are not available yet" : "Your learning library is being prepared"}>{activePage === "assignments" ? "Assignments, assessments, grading and quizzes are not supported by the current backend." : "Learning resources and recordings are not yet supported by the current backend. This page will not show fabricated content."}</EmptyState></div>}
        </>}
      </div>
      <footer className="student-footer"><span>© {new Date().getFullYear()} Solyce Learning</span><span>Purposeful learning. Meaningful progress.</span><button type="button" onClick={() => navigate("support")}>Need help?</button></footer>
    </main>
  </div>;
}
'@

$patchFiles = @(
  "server/src/app.js",
  "client/src/student/StudentApp.jsx"
)
try {
  # Back up every file that will be changed before the first write.
  foreach ($f in $patchFiles) { Backup-File $f }
  New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
  $installationStarted = $true

  Write-Utf8 "server/src/routes/student.routes.js" $routeContent
  $CreatedFiles.Add("server/src/routes/student.routes.js")
  Write-Utf8 "server/src/middleware/require-student.js" $middlewareContent
  $CreatedFiles.Add("server/src/middleware/require-student.js")

  $newApp = $app
  $importAnchor = 'import adminPaymentsRoutes from "./routes/admin-payments.routes.js";'
  Assert-Contains $newApp $importAnchor "admin payments import insertion point"
  $newApp = $newApp.Replace($importAnchor, $importAnchor + "`nimport studentRoutes from `"./routes/student.routes.js`";")
  $mountAnchor = 'app.use("/api/admin/payments", adminPaymentsRoutes);'
  Assert-Contains $newApp $mountAnchor "admin payments mount insertion point"
  $newApp = $newApp.Replace($mountAnchor, $mountAnchor + "`napp.use(`"/api/student`", studentRoutes);")
  
$importCount = [regex]::Matches(
    $newApp,
    [regex]::Escape('import studentRoutes from "./routes/student.routes.js";')
).Count

$mountCount = [regex]::Matches(
    $newApp,
    [regex]::Escape('app.use("/api/student", studentRoutes);')
).Count

if ($importCount -ne 1 -or $mountCount -ne 1) {
    throw "Post-patch validation failed: import count=$importCount; mount count=$mountCount."
}

  Write-Utf8 "server/src/app.js" $newApp
  $ModifiedFiles.Add("server/src/app.js")

  Write-Utf8 "client/src/student/StudentApp.jsx" $frontendContent
  $ModifiedFiles.Add("client/src/student/StudentApp.jsx")

  # Post-install static validation.
  $writtenRoute = Read-Utf8 "server/src/routes/student.routes.js"
  $writtenMiddleware = Read-Utf8 "server/src/middleware/require-student.js"
  $writtenApp = Read-Utf8 "server/src/app.js"
  $writtenFrontend = Read-Utf8 "client/src/student/StudentApp.jsx"
  foreach ($route in @('/auth/register','/auth/login','/auth/me','/auth/logout','/enrollments','/profile')) {
    Assert-Contains $writtenRoute $route "expected student endpoint $route"
  }
  Assert-Contains $writtenMiddleware 'user.role !== "STUDENT"' "student role enforcement"
  Assert-Contains $writtenRoute 'where: { userId: req.student.id }' "student-scoped enrolment query"
  Assert-Contains $writtenRoute 'payments: {' "payments selected for linked enrolments"
  Assert-Contains $writtenFrontend 'credentials: "include"' "frontend session credentials"
  Assert-Contains $writtenFrontend 'student-phase2-auth' "frontend integration marker"
  if (($writtenApp.Split('app.use("/api/student", studentRoutes);').Count - 1) -ne 1) { throw "Student router mount count is not exactly one." }
  if (Test-Path (Join-Path $ProjectRoot ".env")) {
    # Intentionally do not read, copy, or print .env.
    Write-Host "Environment file detected (contents were not read or copied)."
  }

  Write-Host "`nSolyce Student Space Phase 2 files installed."
  Write-Host "Created files:"
  $CreatedFiles | ForEach-Object { Write-Host "  + $_" }
  Write-Host "Modified files:"
  $ModifiedFiles | ForEach-Object { Write-Host "  * $_" }
  Write-Host "Backup directory: $BackupRoot"
  Write-Host "`nStatic post-install checks passed. No database connection, migration, or record mutation was performed."
  Write-Host "Next: run server/client builds and manual authentication/data-isolation tests using the README checklist."
  Write-Host "Rollback: restore the modified files from the backup directory above, then remove only the two files listed under Created files if you have not edited them since installation."
}
catch {
  Write-Error $_
  if ($installationStarted -and $BackedUpFiles.Count -gt 0) {
    Write-Warning "Installation stopped after modifications began. Attempting to restore backed-up files only."
    foreach ($f in $BackedUpFiles) {
      $backup = Join-Path $BackupRoot $f
      $target = Join-Path $ProjectRoot $f
      if (Test-Path $backup) { Copy-Item -LiteralPath $backup -Destination $target -Force }
    }
    foreach ($f in $CreatedFiles) {
      $target = Join-Path $ProjectRoot $f
      if (Test-Path $target) { Remove-Item -LiteralPath $target -Force }
    }
    Write-Warning "Rollback attempt complete. Inspect the working tree before proceeding. Backup: $BackupRoot"
  }
  exit 1
}
