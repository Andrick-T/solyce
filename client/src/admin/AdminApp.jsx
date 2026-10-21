import { useCallback, useEffect, useMemo, useState } from "react";
import AssessmentGrading from "./AssessmentGrading.jsx";
import LearningStudio from "./LearningStudio.jsx";
import "./AdminApp.css";

const API = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/$/, "");
const money = (value) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value ?? 0)} XAF`;
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Douala",
      }).format(new Date(value))
    : "—";
const initialCourse = {
  slug: "",
  title: "",
  description: "",
  language: "ENGLISH",
  examType: "TCF",
  durationWeeks: 12,
  curriculum: "",
  priceXaf: 0,
  isPublished: false,
};
const initialCohort = {
  name: "",
  courseId: "",
  instructorId: "",
  startDate: "",
  endDate: "",
  enrollmentDeadline: "",
  scheduleDescription: "",
  scheduleDays: [],
  scheduleSlot: "",
  timezone: "Africa/Douala",
  capacity: 8,
  minimumStudents: 6,
  priceXaf: "",
  status: "DRAFT",
};

const SOLYCE_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SOLYCE_TIME_SLOTS = [
  { value: "09:00-10:30", label: "09:00–10:30" },
  { value: "11:00-12:30", label: "11:00–12:30" },
  { value: "19:00-20:30", label: "19:00–20:30" },
];

function parseScheduleDescription(value = "") {
  const parts = value.split(" | ");

  if (parts.length !== 2) {
    return { scheduleDays: [], scheduleSlot: "" };
  }

  const scheduleDays = parts[0].split(", ").map((day) => day.trim());
  const scheduleSlot = parts[1];

  const valid =
    scheduleDays.length > 0 &&
    scheduleDays.every((day) => SOLYCE_DAYS.includes(day)) &&
    new Set(scheduleDays).size === scheduleDays.length &&
    SOLYCE_TIME_SLOTS.some((slot) => slot.value === scheduleSlot);

  return valid
    ? { scheduleDays, scheduleSlot }
    : { scheduleDays: [], scheduleSlot: "" };
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const result =
    response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      result?.error?.message || `Request failed (${response.status}).`,
    );
  return result;
}

function Mark() {
  return <span className="admin-brand-mark">S.</span>;
}
function Icon({ name }) {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    courses: (
      <>
        <path d="m3 7 9-4 9 4-9 4-9-4Z" />
        <path d="m5 9 7 3 7-3M5 13l7 3 7-3M5 9v7l7 4 7-4V9" />
      </>
    ),
    cohorts: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M19 15a5 5 0 0 1 3 4v2" />
      </>
    ),
    payments: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.overview}
    </svg>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/admin/auth/login", {
        method: "POST",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <aside className="admin-auth-editorial">
        <a className="admin-auth-editorial-brand" href="/">
          solyce<span>.</span>
        </a>

        <div className="admin-auth-editorial-content">
          <p className="admin-auth-editorial-eyebrow">
            BEHIND EVERY LEARNING JOURNEY
          </p>

          <h2>
            Lead with clarity.
            <em> Build meaningful progress.</em>
          </h2>

          <p>
            A dedicated space to manage learning programs, coordinate
            instructors and create a better experience for every learner.
          </p>
        </div>

        <div className="admin-auth-editorial-footer">
          <span className="admin-auth-editorial-mark">S.</span>
          <span>Language learning, with direction.</span>
        </div>
      </aside>

      <section className="admin-login-card">
        <div className="admin-login-brand">
          <Mark />
          <span>
            solyce<span className="admin-dot">.</span>
          </span>
        </div>

        <p className="admin-eyebrow">ADMINISTRATION PORTAL</p>

        <h1>Welcome back.</h1>

        <p className="admin-login-intro">
          Sign in to manage programs, cohorts and the learning experience.
        </p>

        <form onSubmit={submit} className="admin-form">
          <label>
            Email address
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@solyce.com"
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </label>

          {error && (
            <div className="admin-alert" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="admin-button primary full"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in to your workspace"}
            <span>→</span>
          </button>
        </form>

        <p className="admin-login-foot">
          Secure access for authorised Solyce administrators.
        </p>

        <a className="admin-auth-back-link" href="/">
          ← Back to Solyce website
        </a>
      </section>
    </main>
  );
}

function Field({ label, children, wide = false }) {
  return (
    <label className={`admin-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, subtitle, onClose, children }) {
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal-head">
          <div>
            <p className="admin-eyebrow">SOLYCE WORKSPACE</p>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="admin-icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [page, setPage] = useState("overview");
  const [courses, setCourses] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [studentStatus, setStudentStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [recordBusy, setRecordBusy] = useState(null);

  const [instructorForm, setInstructorForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [instructorSaving, setInstructorSaving] = useState(false);
  const [instructorError, setInstructorError] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [courseModal, setCourseModal] = useState(null);
  const [cohortModal, setCohortModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [courseQuery, setCourseQuery] = useState("");
  const [cohortStatus, setCohortStatus] = useState("ALL");

  const checkSession = useCallback(async () => {
    try {
      const result = await request("/admin/auth/me");
      setUser(result.data?.user || result.user || result.data || result);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => {
      checkSession();
    }, 0);
    return () => clearTimeout(timeout);
  }, [checkSession]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [courseResult, cohortResult, instructorResult] = await Promise.all([
        request("/admin/courses"),
        request("/admin/cohorts"),
        request("/admin/instructors?includeInactive=true"),
      ]);
      setCourses(courseResult.data || []);
      setCohorts(cohortResult.data || []);
      setInstructors(instructorResult.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timeout);
  }, [loadData]);

  const loadEnrollments = useCallback(async () => {
    if (!user) return;
    setStudentLoading(true);
    try {
      const result = await request(
        `/admin/enrollments?status=${encodeURIComponent(studentStatus)}`,
      );
      setEnrollments(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setStudentLoading(false);
    }
  }, [user, studentStatus]);

  const loadPayments = useCallback(async () => {
    if (!user) return;
    setPaymentLoading(true);
    try {
      const result = await request(
        `/admin/payments?status=${encodeURIComponent(paymentStatus)}`,
      );
      const rows = result.data || [];
      setPayments(rows);
      setPaymentDrafts((current) => {
        const next = { ...current };
        for (const p of rows) {
          if (!next[p.id]) {
            next[p.id] = {
              method: p.method || "OTHER",
              receivedAmountXaf: String(p.receivedAmountXaf ?? 0),
              status: p.status || "PENDING",
              transactionReference: p.transactionReference || "",
              verificationNote: p.verificationNote || "",
            };
          }
        }
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  }, [user, paymentStatus]);

  useEffect(() => {
    if (page !== "students") return;
    const timer = window.setTimeout(() => loadEnrollments(), 0);
    return () => window.clearTimeout(timer);
  }, [page, loadEnrollments]);

  useEffect(() => {
    if (page !== "payments") return;
    const timer = window.setTimeout(() => loadPayments(), 0);
    return () => window.clearTimeout(timer);
  }, [page, loadPayments]);

  async function changeEnrollmentStatus(enrollment, status) {
    setRecordBusy(`enrollment-${enrollment.id}`);
    setError("");
    try {
      await request(`/admin/enrollments/${enrollment.id}/status`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({ status }),
      });
      await Promise.all([loadEnrollments(), loadData()]);
      flash(
        status === "CONFIRMED"
          ? "Enrollment confirmed."
          : `Enrollment status updated to ${status.replaceAll("_", " ").toLowerCase()}.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordBusy(null);
    }
  }

  async function savePayment(payment) {
    const draft = paymentDrafts[payment.id];
    if (!draft) return;
    setRecordBusy(`payment-${payment.id}`);
    setError("");
    try {
      await request(`/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({
          method: draft.method,
          receivedAmountXaf: Number(draft.receivedAmountXaf),
          status: draft.status,
          transactionReference: draft.transactionReference.trim() || null,
          verificationNote: draft.verificationNote.trim() || null,
        }),
      });
      await Promise.all([loadPayments(), loadEnrollments(), loadData()]);
      flash("Payment record saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordBusy(null);
    }
  }

  async function logout() {
    try {
      await request("/admin/auth/logout", {
        method: "POST",
        headers: { Origin: window.location.origin },
      });
    } catch {
      // Ignore logout failures and still clear local session.
    }
    setUser(null);
  }
  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  async function saveCourse(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = {
      ...courseModal.form,
      durationWeeks: Number(courseModal.form.durationWeeks),
      priceXaf: Number(courseModal.form.priceXaf),
    };
    try {
      if (courseModal.id)
        await request(`/admin/courses/${courseModal.id}`, {
          method: "PATCH",
          headers: { Origin: window.location.origin },
          body: JSON.stringify(data),
        });
      else
        await request("/admin/courses", {
          method: "POST",
          headers: { Origin: window.location.origin },
          body: JSON.stringify(data),
        });
      setCourseModal(null);
      await loadData();
      flash(courseModal.id ? "Program updated." : "Program created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateCourseApproval(course, status) {
    setRecordBusy(`course-${course.id}`);
    setError("");

    try {
      await request(`/admin/courses/${course.id}/approval`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({ status }),
      });

      await loadData();

      flash(
        status === "APPROVED"
          ? `Program "${course.title}" approved. Publication remains separate.`
          : `Program "${course.title}" rejected.`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordBusy(null);
    }
  }

  async function saveCohort(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const f = cohortModal.form;

    if (!f.scheduleDays?.length) {
      setError("Select at least one learning day.");
      setSaving(false);
      return;
    }

    if (!f.scheduleSlot) {
      setError("Select a Solyce class time slot.");
      setSaving(false);
      return;
    }

    if (["OPEN", "IN_PROGRESS"].includes(f.status) && !f.instructorId) {
      setError(
        "Assign an active instructor before opening or starting a cohort.",
      );
      setSaving(false);
      return;
    }

    const { scheduleDays, scheduleSlot, ...cohortFields } = f;

    const data = {
      ...cohortFields,
      scheduleDescription: `${scheduleDays.join(", ")} | ${scheduleSlot}`,
      courseId: Number(f.courseId),
      instructorId: f.instructorId ? Number(f.instructorId) : null,
      capacity: Number(f.capacity),
      minimumStudents: Number(f.minimumStudents),
      priceXaf: f.priceXaf === "" ? null : Number(f.priceXaf),
      enrollmentDeadline: f.enrollmentDeadline
        ? new Date(f.enrollmentDeadline).toISOString()
        : null,
    };
    if (cohortModal.id) delete data.courseId;
    try {
      if (cohortModal.id)
        await request(`/admin/cohorts/${cohortModal.id}`, {
          method: "PATCH",
          headers: { Origin: window.location.origin },
          body: JSON.stringify(data),
        });
      else
        await request("/admin/cohorts", {
          method: "POST",
          headers: { Origin: window.location.origin },
          body: JSON.stringify(data),
        });
      setCohortModal(null);
      await loadData();
      flash(cohortModal.id ? "Cohort updated." : "Cohort created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  async function toggleInstructorStatus(instructor) {
    const nextStatus = !instructor.isActive;
    const action = nextStatus ? "activate" : "deactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${instructor.fullName}'s account?`,
    );

    if (!confirmed) return;

    setRecordBusy(`instructor-${instructor.id}`);
    setError("");

    try {
      await request(`/admin/instructors/${instructor.id}/status`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      await loadData();

      flash(
        nextStatus
          ? "Instructor account activated."
          : "Instructor account deactivated.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordBusy(null);
    }
  }
  async function saveInstructor(event) {
    event.preventDefault();
    setInstructorSaving(true);
    setInstructorError("");
    setError("");

    try {
      await request("/admin/instructors", {
        method: "POST",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({
          fullName: instructorForm.fullName.trim(),
          email: instructorForm.email.trim().toLowerCase(),
          password: instructorForm.password,
        }),
      });

      setInstructorForm({
        fullName: "",
        email: "",
        password: "",
      });

      await loadData();
      flash("Instructor account created and activated.");
    } catch (err) {
      setInstructorError(err.message);
    } finally {
      setInstructorSaving(false);
    }
  }
  function openCourse(course) {
    setError("");
    setCourseModal({
      id: course?.id,
      form: course
        ? {
            slug: course.slug,
            title: course.title,
            description: course.description,
            language: course.language,
            examType: course.examType,
            durationWeeks: course.durationWeeks,
            curriculum: course.curriculum || "",
            priceXaf: course.priceXaf,
            isPublished: course.isPublished,
          }
        : { ...initialCourse },
    });
  }
  function openCohort(cohort) {
    setError("");
    setCohortModal({
      id: cohort?.id,
      form: cohort
        ? {
            name: cohort.name,
            courseId: String(cohort.courseId),
            instructorId: cohort.instructorId
              ? String(cohort.instructorId)
              : "",
            startDate: String(cohort.startDate).slice(0, 10),
            endDate: String(cohort.endDate).slice(0, 10),
            enrollmentDeadline: cohort.enrollmentDeadline
              ? new Date(cohort.enrollmentDeadline).toISOString().slice(0, 16)
              : "",
            scheduleDescription: cohort.scheduleDescription,
            ...parseScheduleDescription(cohort.scheduleDescription),
            timezone: cohort.timezone || "Africa/Douala",
            capacity: cohort.capacity,
            minimumStudents: cohort.minimumStudents,
            priceXaf: cohort.priceXaf ?? "",
            status: cohort.status,
          }
        : {
            ...initialCohort,
            courseId: courses[0] ? String(courses[0].id) : "",
          },
    });
  }
  const filteredCourses = useMemo(
    () =>
      courses.filter((c) =>
        `${c.title} ${c.examType} ${c.slug}`
          .toLowerCase()
          .includes(courseQuery.toLowerCase()),
      ),
    [courses, courseQuery],
  );
  const filteredCohorts = useMemo(
    () =>
      cohorts.filter(
        (c) => cohortStatus === "ALL" || c.status === cohortStatus,
      ),
    [cohorts, cohortStatus],
  );

  if (authLoading)
    return (
      <div className="admin-loading">
        <span className="admin-spinner" />
        Checking your session…
      </div>
    );
  if (!user) return <Login onLogin={checkSession} />;

  const nav = [
    { id: "overview", label: "Overview", icon: "overview" },
    { id: "courses", label: "Programs", icon: "courses" },
    { id: "cohorts", label: "Cohorts", icon: "cohorts" },
    { id: "instructors", label: "Instructors", icon: "students" },
    { id: "students", label: "Students", icon: "students" },
    { id: "payments", label: "Payments", icon: "payments" },
    { id: "grading", label: "Assessment grading", icon: "courses" },
    { id: "learning", label: "Learning Studio", icon: "courses" },
  ];
  const activeStudents = cohorts.reduce(
    (sum, c) => sum + (c.enrolledCount || 0),
    0,
  );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/" aria-label="Solyce home">
          <Mark />
          <span>
            solyce<span className="admin-dot">.</span>
          </span>
        </a>
        <div className="admin-workspace-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Administration">
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => {
                setPage(item.id);
                setError("");
              }}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-help-card">
            <span className="help-mark">✳</span>
            <strong>Built around progress.</strong>
            <p>Keep every learning journey moving forward.</p>
          </div>
          <button className="admin-logout" onClick={logout}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {nav.find((n) => n.id === page)?.label || "Overview"}
            </strong>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-live-dot" /> <span>Admin workspace</span>
            <div className="admin-avatar">
              {(user.fullName || user.name || "A").slice(0, 1).toUpperCase()}
            </div>
            <div className="admin-user-copy">
              <strong>{user.fullName || user.name || "Administrator"}</strong>
              <span>Administrator</span>
            </div>
          </div>
        </header>
        <div className="admin-content">
          {page !== "grading" && page !== "learning" && (
            <div className="admin-page-heading">
              <div>
                <p className="admin-eyebrow">SOLYCE / MANAGEMENT</p>
                <h1>
                  {page === "overview"
                    ? "A clearer view of progress."
                    : page === "courses"
                      ? "Programs"
                      : page === "cohorts"
                        ? "Cohorts"
                        : page === "instructors"
                          ? "Instructor management"
                          : page === "students"
                            ? "Student management"
                            : page === "grading"
                              ? "Assessment grading"
                              : "Payments"}
                </h1>
                <p>
                  {page === "overview"
                    ? "Your learning programs, upcoming intakes and operations at a glance."
                    : page === "courses"
                      ? "Create, refine and publish the programs learners can discover."
                      : page === "cohorts"
                        ? "Plan live learning groups, assign instructors and manage enrolment windows."
                        : page === "instructors"
                          ? "Create active instructor accounts and review who is available for cohort assignment."
                          : page === "grading"
                            ? "Review submitted work, assign grades and publish learner feedback."
                            : page === "students"
                              ? "Review guest bookings, manage enrolment status and track learner cohorts."
                              : "Record offline payments, verify full tuition and keep enrolment decisions auditable."}
                </p>
              </div>
              <div className="admin-heading-actions">
                <button
                  className="admin-button subtle"
                  onClick={loadData}
                  disabled={loading}
                >
                  ↻ Refresh
                </button>
                {page === "courses" && (
                  <button
                    className="admin-button primary"
                    onClick={() => openCourse(null)}
                  >
                    ＋ New program
                  </button>
                )}
                {page === "cohorts" && (
                  <button
                    className="admin-button primary"
                    onClick={() => openCohort(null)}
                    disabled={!courses.length}
                  >
                    ＋ New cohort
                  </button>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="admin-alert global-alert" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="admin-notice" role="status">
              ✓ {notice}
            </div>
          )}
          {loading && (
            <div className="admin-inline-loading">
              <span className="admin-spinner" />
              Syncing workspace data…
            </div>
          )}
          {page === "overview" && (
            <>
              <div className="admin-stat-grid">
                <article className="admin-stat-card">
                  <span className="stat-label">Total programs</span>
                  <span className="stat-value">{courses.length}</span>
                  <span className="stat-foot">
                    <span className="stat-indicator" />{" "}
                    {courses.filter((c) => c.isPublished).length} published
                  </span>
                  <span className="stat-icon">
                    <Icon name="courses" />
                  </span>
                </article>
                <article className="admin-stat-card">
                  <span className="stat-label">Active cohorts</span>
                  <span className="stat-value">
                    {
                      cohorts.filter((c) =>
                        ["OPEN", "IN_PROGRESS"].includes(c.status),
                      ).length
                    }
                  </span>
                  <span className="stat-foot">
                    Open enrolment and live classes
                  </span>
                  <span className="stat-icon">
                    <Icon name="cohorts" />
                  </span>
                </article>
                <article className="admin-stat-card">
                  <span className="stat-label">Enrolled learners</span>
                  <span className="stat-value">{activeStudents}</span>
                  <span className="stat-foot">Across all cohorts</span>
                  <span className="stat-icon">
                    <Icon name="students" />
                  </span>
                </article>
                <article className="admin-stat-card">
                  <span className="stat-label">Instructor coverage</span>
                  <span className="stat-value">
                    {cohorts.filter((c) => c.instructorId).length}
                    <small> / {cohorts.length}</small>
                  </span>
                  <span className="stat-foot">
                    Cohorts with an assigned instructor
                  </span>
                  <span className="stat-icon">
                    <Icon name="overview" />
                  </span>
                </article>
              </div>
              <div className="admin-overview-grid">
                <section className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <p className="admin-eyebrow">RECENT ACTIVITY</p>
                      <h2>Recently updated programs</h2>
                    </div>
                    <button
                      className="admin-text-button"
                      onClick={() => setPage("courses")}
                    >
                      View all ↗
                    </button>
                  </div>
                  {courses.length ? (
                    courses.slice(0, 5).map((c) => (
                      <div className="admin-list-row" key={c.id}>
                        <div className="admin-course-monogram">
                          {c.examType?.slice(0, 2).toUpperCase() || "S."}
                        </div>
                        <div className="admin-row-main">
                          <strong>{c.title}</strong>
                          <span>
                            {c.durationWeeks} weeks ·{" "}
                            {c.language === "FRENCH" ? "French" : "English"}
                          </span>
                        </div>
                        <span
                          className={`admin-status ${c.isPublished ? "published" : "draft"}`}
                        >
                          {c.isPublished ? "Published" : "Draft"}
                        </span>
                        <strong className="admin-row-price">
                          {money(c.priceXaf)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <div className="admin-empty">
                      No programs yet. Create your first program to get started.
                    </div>
                  )}
                </section>
                <section className="admin-panel">
                  <div className="admin-panel-heading">
                    <div>
                      <p className="admin-eyebrow">COHORT READINESS</p>
                      <h2>Upcoming cohorts</h2>
                    </div>
                    <button
                      className="admin-text-button"
                      onClick={() => setPage("cohorts")}
                    >
                      Manage ↗
                    </button>
                  </div>
                  {cohorts.length ? (
                    cohorts.slice(0, 5).map((c) => (
                      <div className="admin-cohort-row" key={c.id}>
                        <div className="admin-date-tile">
                          <strong>{new Date(c.startDate).getUTCDate()}</strong>
                          <span>
                            {new Date(c.startDate)
                              .toLocaleString("en-GB", {
                                month: "short",
                                timeZone: "UTC",
                              })
                              .toUpperCase()}
                          </span>
                        </div>
                        <div className="admin-row-main">
                          <strong>{c.name}</strong>
                          <span>
                            {c.course?.title || "Program"} ·{" "}
                            {c.instructor?.fullName ||
                              "Instructor not assigned"}
                          </span>
                          <div className="admin-mini-progress">
                            <span
                              style={{
                                width: `${Math.min(100, ((c.enrolledCount || 0) / Math.max(1, c.capacity)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          className={`admin-status status-${c.status.toLowerCase()}`}
                        >
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="admin-empty">
                      No cohorts yet. Create a cohort from a program.
                    </div>
                  )}
                  <div className="admin-readiness-note">
                    <span>✳</span>
                    <p>
                      <strong>Live learning comes first.</strong> Every cohort
                      must have an assigned active instructor before enrolment
                      can open.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "courses" && (
            <section className="admin-panel admin-table-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">PROGRAM CATALOGUE</p>
                  <h2>
                    All programs{" "}
                    <span className="count-pill">{courses.length}</span>
                  </h2>
                </div>
                <input
                  className="admin-search"
                  value={courseQuery}
                  onChange={(e) => setCourseQuery(e.target.value)}
                  placeholder="Search programs…"
                  aria-label="Search programs"
                />
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Program</th>
                      <th>Language</th>
                      <th>Duration</th>
                      <th>Tuition</th>
                      <th>Status</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="table-primary">{c.title}</div>
                          <div className="table-secondary">
                            {c.examType} · /{c.slug}
                          </div>
                        </td>
                        <td>
                          {c.language === "FRENCH" ? "French" : "English"}
                        </td>
                        <td>{c.durationWeeks} weeks</td>
                        <td className="table-money">{money(c.priceXaf)}</td>

                        <td>
                          <div>
                            <span
                              className={`admin-status status-${String(
                                c.approvalStatus || "PENDING_REVIEW",
                              ).toLowerCase()}`}
                            >
                              {String(
                                c.approvalStatus || "PENDING_REVIEW",
                              ).replaceAll("_", " ")}
                            </span>
                          </div>
                          <div className="table-secondary">
                            {c.isPublished ? "Published" : "Unpublished"}
                          </div>
                        </td>

                        <td>{date(c.updatedAt)}</td>
                        <td>
                          <button
                            className="admin-button small subtle"
                            onClick={() => openCourse(c)}
                          >
                            Edit
                          </button>

                          {c.approvalStatus === "PENDING_REVIEW" && (
                            <>
                              <button
                                className="admin-button small primary"
                                disabled={recordBusy === `course-${c.id}`}
                                onClick={() =>
                                  updateCourseApproval(c, "APPROVED")
                                }
                              >
                                {recordBusy === `course-${c.id}`
                                  ? "Saving…"
                                  : "Approve"}
                              </button>

                              <button
                                className="admin-button small subtle"
                                disabled={recordBusy === `course-${c.id}`}
                                onClick={() =>
                                  updateCourseApproval(c, "REJECTED")
                                }
                              >
                                {recordBusy === `course-${c.id}`
                                  ? "Saving…"
                                  : "Reject"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredCourses.length && (
                  <div className="admin-empty">
                    No programs match this search.
                  </div>
                )}
              </div>
            </section>
          )}
          {page === "cohorts" && (
            <section className="admin-panel admin-table-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">LIVE LEARNING OPERATIONS</p>
                  <h2>
                    All cohorts{" "}
                    <span className="count-pill">{cohorts.length}</span>
                  </h2>
                </div>
                <select
                  className="admin-search"
                  value={cohortStatus}
                  onChange={(e) => setCohortStatus(e.target.value)}
                  aria-label="Filter cohorts by status"
                >
                  <option value="ALL">All statuses</option>
                  {[
                    "DRAFT",
                    "OPEN",
                    "IN_PROGRESS",
                    "COMPLETED",
                    "CANCELLED",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Cohort</th>
                      <th>Program</th>
                      <th>Instructor</th>
                      <th>Schedule</th>
                      <th>Places</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCohorts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="table-primary">{c.name}</div>
                          <div className="table-secondary">
                            {date(c.startDate)} – {date(c.endDate)}
                          </div>
                        </td>
                        <td>
                          {c.course?.title ||
                            courses.find((x) => x.id === c.courseId)?.title ||
                            "—"}
                        </td>
                        <td>
                          {c.instructor?.fullName || (
                            <span className="unassigned">Not assigned</span>
                          )}
                        </td>
                        <td>
                          <div className="table-primary">
                            {c.scheduleDescription}
                          </div>
                          <div className="table-secondary">{c.timezone}</div>
                        </td>
                        <td>
                          {c.enrolledCount || 0} / {c.capacity}
                        </td>
                        <td>
                          <span
                            className={`admin-status status-${c.status.toLowerCase()}`}
                          >
                            {c.status.replace("_", " ")}
                          </span>
                        </td>
                        <td>
                          <button
                            className="admin-button small subtle"
                            onClick={() => openCohort(c)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredCohorts.length && (
                  <div className="admin-empty">
                    No cohorts match this status.
                  </div>
                )}
              </div>
            </section>
          )}
          {page === "instructors" && (
            <div className="admin-overview-grid">
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">TEAM ACCESS</p>
                    <h2>Create an instructor account</h2>
                  </div>
                </div>

                <p className="admin-panel-description">
                  Instructor accounts are activated immediately and can be
                  assigned to cohorts. Share the initial password securely with
                  the instructor.
                </p>

                <form className="admin-form-grid" onSubmit={saveInstructor}>
                  <Field label="Full name" wide>
                    <input
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={120}
                      value={instructorForm.fullName}
                      onChange={(e) =>
                        setInstructorForm((f) => ({
                          ...f,
                          fullName: e.target.value,
                        }))
                      }
                      placeholder="Instructor full name"
                    />
                  </Field>

                  <Field label="Email address" wide>
                    <input
                      autoComplete="email"
                      type="email"
                      required
                      maxLength={254}
                      value={instructorForm.email}
                      onChange={(e) =>
                        setInstructorForm((f) => ({
                          ...f,
                          email: e.target.value,
                        }))
                      }
                      placeholder="instructor@example.com"
                    />
                  </Field>

                  <Field label="Temporary password" wide>
                    <input
                      autoComplete="new-password"
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={instructorForm.password}
                      onChange={(e) =>
                        setInstructorForm((f) => ({
                          ...f,
                          password: e.target.value,
                        }))
                      }
                      placeholder="At least 12 characters"
                    />
                  </Field>

                  <p className="admin-form-note">
                    Use a unique password of at least 12 characters. The
                    password is sent to the server for hashing and is not
                    displayed again after the account is created.
                  </p>

                  {instructorError && (
                    <div className="admin-alert wide" role="alert">
                      {instructorError}
                    </div>
                  )}

                  <div className="admin-modal-actions">
                    <button
                      type="button"
                      className="admin-button subtle"
                      disabled={instructorSaving}
                      onClick={() => {
                        setInstructorForm({
                          fullName: "",
                          email: "",
                          password: "",
                        });
                        setInstructorError("");
                      }}
                    >
                      Clear
                    </button>

                    <button
                      className="admin-button primary"
                      disabled={instructorSaving}
                    >
                      {instructorSaving
                        ? "Creating account…"
                        : "Create instructor"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="admin-panel admin-table-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-eyebrow">AVAILABLE FOR ASSIGNMENT</p>
                    <h2>
                      Active instructors{" "}
                      <span className="count-pill">{instructors.length}</span>
                    </h2>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Instructor</th>
                        <th>Status</th>
                        <th>Assigned cohorts</th>
                        <th>Access</th>
                      </tr>
                    </thead>

                    <tbody>
                      {instructors.map((instructor) => {
                        const assignedCount = cohorts.filter(
                          (cohort) =>
                            String(
                              cohort.instructorId ??
                                cohort.instructor?.id ??
                                "",
                            ) === String(instructor.id),
                        ).length;

                        return (
                          <tr key={instructor.id}>
                            <td>
                              <div className="table-primary">
                                {instructor.fullName}
                              </div>
                              <div className="table-secondary">
                                {instructor.email}
                              </div>
                            </td>
                            <td>{assignedCount}</td>
                            <td>
                              <span
                                className="table-secondary"
                                aria-label={`Account status: ${
                                  instructor.isActive ? "Active" : "Inactive"
                                }`}
                              >
                                {instructor.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>

                            <td>{assignedCount}</td>

                            <td>
                              <button
                                type="button"
                                className={`admin-button small ${
                                  instructor.isActive ? "subtle" : "primary"
                                }`}
                                disabled={
                                  recordBusy === `instructor-${instructor.id}`
                                }
                                onClick={() =>
                                  toggleInstructorStatus(instructor)
                                }
                              >
                                {recordBusy === `instructor-${instructor.id}`
                                  ? "Saving…"
                                  : instructor.isActive
                                    ? "Deactivate"
                                    : "Activate"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {!instructors.length && (
                    <div className="admin-empty">
                      No active instructors yet. Create the first account using
                      the form.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
          {page === "students" && (
            <section className="admin-panel admin-table-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">LEARNER RECORDS</p>
                  <h2>
                    Bookings and enrolments{" "}
                    <span className="count-pill">{enrollments.length}</span>
                  </h2>
                </div>
                <div className="admin-heading-actions">
                  <input
                    className="admin-search"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search name, email or reference…"
                    aria-label="Search learners"
                  />
                  <select
                    className="admin-search"
                    value={studentStatus}
                    onChange={(e) => setStudentStatus(e.target.value)}
                    aria-label="Filter enrolments"
                  >
                    <option value="ALL">All statuses</option>
                    {[
                      "PENDING",
                      "AWAITING_PAYMENT",
                      "PAYMENT_UNDER_REVIEW",
                      "CONFIRMED",
                      "CANCELLED",
                      "WAITLISTED",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    className="admin-button subtle"
                    onClick={loadEnrollments}
                    disabled={studentLoading}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>
              {studentLoading ? (
                <div className="admin-inline-loading">
                  <span className="admin-spinner" /> Loading enrolments…
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Learner</th>
                        <th>Program / cohort</th>
                        <th>Booking</th>
                        <th>Tuition</th>
                        <th>Payment</th>
                        <th>Enrolment status</th>
                        <th>Update status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollments
                        .filter((e) =>
                          `${e.student?.fullName || ""} ${e.student?.email || ""} ${e.bookingReference || ""} ${e.cohort?.name || ""} ${e.cohort?.course?.title || ""}`
                            .toLowerCase()
                            .includes(studentQuery.toLowerCase()),
                        )
                        .map((e) => {
                          const latestPayment = e.payments?.[0];
                          return (
                            <tr key={e.id}>
                              <td>
                                <div className="table-primary">
                                  {e.student?.fullName || "Unnamed learner"}
                                </div>
                                <div className="table-secondary">
                                  {e.student?.email || "No email"}
                                  {e.student?.phone
                                    ? ` · ${e.student.phone}`
                                    : ""}
                                </div>
                              </td>
                              <td>
                                <div className="table-primary">
                                  {e.cohort?.course?.title ||
                                    "Program unavailable"}
                                </div>
                                <div className="table-secondary">
                                  {e.cohort?.name || "Cohort unavailable"} ·{" "}
                                  {date(e.cohort?.startDate)}
                                </div>
                              </td>
                              <td>
                                <div className="table-primary">
                                  {e.bookingReference ||
                                    `SOL-${String(e.id).padStart(6, "0")}`}
                                </div>
                                <div className="table-secondary">
                                  {date(e.createdAt)}
                                </div>
                              </td>
                              <td className="table-money">
                                {money(e.agreedPriceXaf)}
                              </td>
                              <td>
                                <span
                                  className={`admin-status status-${(latestPayment?.status || "PENDING").toLowerCase()}`}
                                >
                                  {(
                                    latestPayment?.status || "NO PAYMENT"
                                  ).replaceAll("_", " ")}
                                </span>
                                <div className="table-secondary">
                                  {latestPayment
                                    ? `${money(latestPayment.receivedAmountXaf)} / ${money(latestPayment.expectedAmountXaf)}`
                                    : "No payment record"}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`admin-status status-${String(e.status).toLowerCase()}`}
                                >
                                  {String(e.status).replaceAll("_", " ")}
                                </span>
                              </td>
                              <td>
                                <select
                                  className="admin-search"
                                  aria-label={`Change status for ${e.student?.fullName || e.id}`}
                                  value={e.status}
                                  disabled={
                                    recordBusy === `enrollment-${e.id}` ||
                                    e.status === "CANCELLED"
                                  }
                                  onChange={(ev) =>
                                    changeEnrollmentStatus(e, ev.target.value)
                                  }
                                >
                                  {[
                                    "PENDING",
                                    "AWAITING_PAYMENT",
                                    "PAYMENT_UNDER_REVIEW",
                                    "CONFIRMED",
                                    "CANCELLED",
                                    "WAITLISTED",
                                  ].map((s) => (
                                    <option key={s} value={s}>
                                      {s.replaceAll("_", " ")}
                                    </option>
                                  ))}
                                </select>
                                {recordBusy === `enrollment-${e.id}` && (
                                  <div className="table-secondary">Saving…</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {!enrollments.length && (
                    <div className="admin-empty">
                      No enrolments found for this status.
                    </div>
                  )}
                  {!!enrollments.length &&
                    !enrollments.some((e) =>
                      `${e.student?.fullName || ""} ${e.student?.email || ""} ${e.bookingReference || ""} ${e.cohort?.name || ""} ${e.cohort?.course?.title || ""}`
                        .toLowerCase()
                        .includes(studentQuery.toLowerCase()),
                    ) && (
                      <div className="admin-empty">
                        No enrolments match this search.
                      </div>
                    )}
                </div>
              )}
              <p className="admin-form-note">
                Confirmation is protected by the server: a booking cannot be
                confirmed until a full payment has been verified. Cancelled
                enrolments cannot be reopened.
              </p>
            </section>
          )}
          {page === "grading" && <AssessmentGrading />}
          {page === "learning" && <LearningStudio />}
          {page === "payments" && (
            <section className="admin-panel admin-table-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">OFFLINE PAYMENT OPERATIONS</p>
                  <h2>
                    Payment register{" "}
                    <span className="count-pill">{payments.length}</span>
                  </h2>
                </div>
                <div className="admin-heading-actions">
                  <select
                    className="admin-search"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    aria-label="Filter payments"
                  >
                    <option value="ALL">All statuses</option>
                    {[
                      "PENDING",
                      "UNDER_REVIEW",
                      "VERIFIED",
                      "REJECTED",
                      "REFUNDED",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    className="admin-button subtle"
                    onClick={loadPayments}
                    disabled={paymentLoading}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>
              {paymentLoading ? (
                <div className="admin-inline-loading">
                  <span className="admin-spinner" /> Loading payments…
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Learner / booking</th>
                        <th>Program / cohort</th>
                        <th>Required</th>
                        <th>Received</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th>Status</th>
                        <th>Verification note</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const d = paymentDrafts[p.id] || {
                          method: p.method || "OTHER",
                          receivedAmountXaf: String(p.receivedAmountXaf ?? 0),
                          status: p.status || "PENDING",
                          transactionReference: p.transactionReference || "",
                          verificationNote: p.verificationNote || "",
                        };
                        const setDraft = (key, value) =>
                          setPaymentDrafts((old) => ({
                            ...old,
                            [p.id]: { ...d, [key]: value },
                          }));
                        const busy = recordBusy === `payment-${p.id}`;
                        const refunded = p.status === "REFUNDED";
                        return (
                          <tr key={p.id}>
                            <td>
                              <div className="table-primary">
                                {p.student?.fullName || "Unnamed learner"}
                              </div>
                              <div className="table-secondary">
                                {p.student?.email || "No email"} ·{" "}
                                {p.bookingReference}
                              </div>
                            </td>
                            <td>
                              <div className="table-primary">
                                {p.enrollment?.cohort?.course?.title ||
                                  "Program unavailable"}
                              </div>
                              <div className="table-secondary">
                                {p.enrollment?.cohort?.name ||
                                  "Cohort unavailable"}
                              </div>
                            </td>
                            <td className="table-money">
                              {money(p.expectedAmountXaf)}
                            </td>
                            <td>
                              <input
                                aria-label={`Amount received for payment ${p.id}`}
                                type="number"
                                min="0"
                                step="1"
                                className="admin-search"
                                value={d.receivedAmountXaf}
                                disabled={busy || refunded}
                                onChange={(e) =>
                                  setDraft("receivedAmountXaf", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <select
                                aria-label={`Payment method ${p.id}`}
                                className="admin-search"
                                value={d.method}
                                disabled={busy || refunded}
                                onChange={(e) =>
                                  setDraft("method", e.target.value)
                                }
                              >
                                {[
                                  ["MTN_MOMO", "MTN Mobile Money"],
                                  ["ORANGE_MONEY", "Orange Money"],
                                  ["BANK_TRANSFER", "Bank transfer"],
                                  ["CASH", "Cash"],
                                  ["OTHER", "Other"],
                                ].map(([v, label]) => (
                                  <option key={v} value={v}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                aria-label={`Transaction reference ${p.id}`}
                                className="admin-search"
                                maxLength="191"
                                value={d.transactionReference}
                                disabled={busy || refunded}
                                onChange={(e) =>
                                  setDraft(
                                    "transactionReference",
                                    e.target.value,
                                  )
                                }
                                placeholder="Optional reference"
                              />
                            </td>
                            <td>
                              <select
                                aria-label={`Payment status ${p.id}`}
                                className="admin-search"
                                value={d.status}
                                disabled={busy || refunded}
                                onChange={(e) =>
                                  setDraft("status", e.target.value)
                                }
                              >
                                {[
                                  "PENDING",
                                  "UNDER_REVIEW",
                                  "VERIFIED",
                                  "REJECTED",
                                  "REFUNDED",
                                ].map((s) => (
                                  <option key={s} value={s}>
                                    {s.replaceAll("_", " ")}
                                  </option>
                                ))}
                              </select>
                              <div className="table-secondary">
                                {p.verifiedAt
                                  ? `Verified ${date(p.verifiedAt)}`
                                  : ""}
                              </div>
                            </td>
                            <td>
                              <textarea
                                aria-label={`Verification note ${p.id}`}
                                rows="2"
                                maxLength="5000"
                                className="admin-search"
                                value={d.verificationNote}
                                disabled={busy || refunded}
                                onChange={(e) =>
                                  setDraft("verificationNote", e.target.value)
                                }
                                placeholder="Optional audit note"
                              />
                            </td>
                            <td>
                              <button
                                className="admin-button small primary"
                                disabled={
                                  busy ||
                                  refunded ||
                                  !String(d.receivedAmountXaf).trim() ||
                                  Number(d.receivedAmountXaf) < 0 ||
                                  !Number.isInteger(Number(d.receivedAmountXaf))
                                }
                                onClick={() => savePayment(p)}
                              >
                                {busy ? "Saving…" : "Save"}
                              </button>
                              {refunded && (
                                <div className="table-secondary">Locked</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!payments.length && (
                    <div className="admin-empty">
                      No payments found for this status.
                    </div>
                  )}
                </div>
              )}
              <p className="admin-form-note">
                Only mark a payment VERIFIED after checking the funds were
                received. The server requires the full tuition amount and
                automatically confirms the linked enrolment when verification
                succeeds. Refunded records are locked.
              </p>
            </section>
          )}
          <footer className="admin-footer">
            <span>© {new Date().getFullYear()} Solyce · Administration</span>
            <span>Purposeful learning. Meaningful progress.</span>
          </footer>
        </div>
      </main>
      {courseModal && (
        <Modal
          title={courseModal.id ? "Edit program" : "Create a program"}
          subtitle="Program details appear in the public catalogue when published."
          onClose={() => setCourseModal(null)}
        >
          <form className="admin-form-grid" onSubmit={saveCourse}>
            <Field label="Program title">
              <input
                required
                minLength="3"
                maxLength="191"
                value={courseModal.form.title}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, title: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="URL slug">
              <input
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                value={courseModal.form.slug}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, slug: e.target.value },
                  }))
                }
                placeholder="tcf-preparation"
              />
            </Field>
            <Field label="Exam / program type">
              <input
                required
                maxLength="50"
                value={courseModal.form.examType}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, examType: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Language">
              <select
                value={courseModal.form.language}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, language: e.target.value },
                  }))
                }
              >
                <option value="ENGLISH">English</option>
                <option value="FRENCH">French</option>
              </select>
            </Field>
            <Field label="Duration (weeks)">
              <input
                type="number"
                min="1"
                max="104"
                required
                value={courseModal.form.durationWeeks}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, durationWeeks: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Tuition (XAF)">
              <input
                type="number"
                min="0"
                step="1"
                required
                value={courseModal.form.priceXaf}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, priceXaf: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Description" wide>
              <textarea
                rows="4"
                minLength="10"
                required
                value={courseModal.form.description}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, description: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Curriculum (one item per line)" wide>
              <textarea
                rows="4"
                value={courseModal.form.curriculum}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, curriculum: e.target.value },
                  }))
                }
              />
            </Field>
            <label className="admin-publish-toggle">
              <input
                type="checkbox"
                checked={courseModal.form.isPublished}
                onChange={(e) =>
                  setCourseModal((m) => ({
                    ...m,
                    form: { ...m.form, isPublished: e.target.checked },
                  }))
                }
                disabled={
                  saving ||
                  (courseModal.form.isPublished === false &&
                    Boolean(courseModal.id) &&
                    courses.find((c) => c.id === courseModal.id)
                      ?.approvalStatus !== "APPROVED")
                }
              />
              <span>
                <strong>Publish this program</strong>

                <small>
                  Only approved programs can be published in the public
                  catalogue.
                </small>
              </span>
            </label>
            {error && (
              <div className="admin-alert wide" role="alert">
                {error}
              </div>
            )}
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-button subtle"
                onClick={() => setCourseModal(null)}
              >
                Cancel
              </button>
              <button className="admin-button primary" disabled={saving}>
                {saving ? "Saving…" : "Save program"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {cohortModal && (
        <Modal
          title={cohortModal.id ? "Edit cohort" : "Create a cohort"}
          subtitle="Every open cohort requires a published program and an assigned active instructor."
          onClose={() => setCohortModal(null)}
        >
          <form className="admin-form-grid" onSubmit={saveCohort}>
            <Field label="Cohort name" wide>
              <input
                required
                minLength="2"
                maxLength="150"
                value={cohortModal.form.name}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, name: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Program">
              <select
                required
                value={cohortModal.form.courseId}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, courseId: e.target.value },
                  }))
                }
              >
                <option value="">Select program</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {!c.isPublished ? " (draft)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Assigned instructor">
              <select
                value={cohortModal.form.instructorId}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, instructorId: e.target.value },
                  }))
                }
              >
                <option value="">Select an active instructor</option>

                {(() => {
                  const assignedInstructor = instructors.find(
                    (instructor) =>
                      String(instructor.id) ===
                      String(cohortModal.form.instructorId),
                  );

                  return (
                    <>
                      {assignedInstructor && !assignedInstructor.isActive && (
                        <option value={String(assignedInstructor.id)}>
                          {assignedInstructor.fullName} · Inactive (existing
                          assignment)
                        </option>
                      )}

                      {instructors
                        .filter((instructor) => instructor.isActive)
                        .map((instructor) => (
                          <option
                            key={instructor.id}
                            value={String(instructor.id)}
                          >
                            {instructor.fullName} · {instructor.email}
                          </option>
                        ))}
                    </>
                  );
                })()}
              </select>
            </Field>
            <Field label="Start date">
              <input
                type="date"
                required
                value={cohortModal.form.startDate}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, startDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                required
                value={cohortModal.form.endDate}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, endDate: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Enrolment deadline">
              <input
                type="datetime-local"
                value={cohortModal.form.enrollmentDeadline}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, enrollmentDeadline: e.target.value },
                  }))
                }
              />
            </Field>

            <Field label="Learning days" wide>
              <div className="admin-cohort-days">
                {SOLYCE_DAYS.map((day) => (
                  <label key={day} className="admin-cohort-day">
                    <input
                      type="checkbox"
                      checked={cohortModal.form.scheduleDays.includes(day)}
                      onChange={(event) =>
                        setCohortModal((current) => ({
                          ...current,
                          form: {
                            ...current.form,
                            scheduleDays: event.target.checked
                              ? [...current.form.scheduleDays, day]
                              : current.form.scheduleDays.filter(
                                  (selectedDay) => selectedDay !== day,
                                ),
                          },
                        }))
                      }
                      disabled={saving}
                    />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Class time slot">
              <select
                required
                value={cohortModal.form.scheduleSlot}
                onChange={(event) =>
                  setCohortModal((current) => ({
                    ...current,
                    form: {
                      ...current.form,
                      scheduleSlot: event.target.value,
                    },
                  }))
                }
                disabled={saving}
              >
                <option value="">Select a time slot</option>
                {SOLYCE_TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
              <small>All times use the Africa/Douala timezone.</small>
            </Field>

            <Field label="Capacity">
              <input
                type="number"
                min="1"
                max="8"
                required
                value={cohortModal.form.capacity}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, capacity: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Minimum students">
              <input
                type="number"
                min="1"
                max="8"
                required
                value={cohortModal.form.minimumStudents}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, minimumStudents: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Cohort tuition (XAF, optional)">
              <input
                type="number"
                min="0"
                value={cohortModal.form.priceXaf}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, priceXaf: e.target.value },
                  }))
                }
                placeholder="Use program price"
              />
            </Field>
            <Field label="Status">
              <select
                value={cohortModal.form.status}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, status: e.target.value },
                  }))
                }
              >
                {["DRAFT", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Timezone">
              <input
                required
                value={cohortModal.form.timezone}
                onChange={(e) =>
                  setCohortModal((m) => ({
                    ...m,
                    form: { ...m.form, timezone: e.target.value },
                  }))
                }
              />
            </Field>
            {error && (
              <div className="admin-alert wide" role="alert">
                {error}
              </div>
            )}
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-button subtle"
                onClick={() => setCohortModal(null)}
              >
                Cancel
              </button>
              <button className="admin-button primary" disabled={saving}>
                {saving ? "Saving…" : "Save cohort"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
