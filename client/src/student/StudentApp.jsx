import { useCallback, useEffect, useMemo, useState } from "react";
import "./StudentApp.css";
import StudentAssessments from "./StudentAssessments.jsx";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "▦", group: "LEARNING" },
  { id: "courses", label: "My learning", icon: "▤", group: "LEARNING" },
  { id: "schedule", label: "My schedule", icon: "▦", group: "LEARNING" },
  {
    id: "assignments",
    label: "Assignments & assessments",
    icon: "✓",
    group: "LEARNING",
  },
  { id: "resources", label: "Resources", icon: "▧", group: "LEARNING" },
  { id: "payments", label: "Payments", icon: "◇", group: "ACCOUNT" },
  { id: "profile", label: "My profile", icon: "○", group: "ACCOUNT" },
  { id: "support", label: "Help & support", icon: "?", group: "ACCOUNT" },
];
const pageCopy = {
  courses: {
    eyebrow: "YOUR LEARNING PATH",
    title: "My learning",
    description: "Your enrolments and program details.",
  },
  schedule: {
    eyebrow: "PLAN AHEAD",
    title: "My schedule",
    description: "Your cohort dates and class schedule details.",
  },
  assignments: {
    eyebrow: "PRACTICE & FEEDBACK",
    title: "Assignments & assessments",
    description:
      "Complete your assessments, submit your work and review your feedback.",
  },
  resources: {
    eyebrow: "YOUR LEARNING LIBRARY",
    title: "Learning resources",
    description:
      "Find your preparation materials, lesson documents and practice resources in one place.",
  },
  payments: {
    eyebrow: "ACCOUNT OVERVIEW",
    title: "Payments",
    description: "Payment history associated with your linked enrolments.",
  },
  profile: {
    eyebrow: "YOUR ACCOUNT",
    title: "My profile",
    description: "Update the name on your student account.",
  },
  support: {
    eyebrow: "WE ARE HERE TO HELP",
    title: "Help & support",
    description: "Get help with an existing or previous Solyce booking.",
  },
};
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api/student${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      body?.error?.message || "Something went wrong. Please try again.",
    );
  return body?.data;
}
function StudentBrand() {
  return (
    <a
      className="student-brand"
      href="/student"
      aria-label="Solyce student home"
    >
      <span className="student-brand-mark">S.</span>
      <span>
        solyce<span className="student-brand-period">.</span>
      </span>
    </a>
  );
}
function EmptyState({ title, children }) {
  return (
    <div className="student-empty">
      <div className="student-empty-icon">✳</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function money(value) {
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Number(value || 0),
    ) + " XAF"
  );
}
function date(value) {
  if (!value) return "Not specified";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Not specified"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(d);
}

function dateTime(value) {
  if (!value) return "Not scheduled";
  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "Not scheduled"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Douala",
      }).format(d);
}

function statusLabel(value) {
  return String(value || "UNKNOWN")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

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

  const [learningSessions, setLearningSessions] = useState([]);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningError, setLearningError] = useState("");

  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const [sessionDetailError, setSessionDetailError] = useState("");
  const [requestedSessionId, setRequestedSessionId] = useState(null);
  const [passwordResetMode, setPasswordResetMode] = useState(() =>
    window.location.pathname === "/student/reset-password" ? "confirm" : "",
  );
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const loadSessionDetail = useCallback(async (sessionId) => {
    setRequestedSessionId(sessionId);
    setSessionDetailLoading(true);
    setSessionDetailError("");
    setSelectedSession(null);

    try {
      const result = await api(`/learning/sessions/${sessionId}`);

      if (!result || result.id !== sessionId) {
        throw new Error("Unable to load this learning session.");
      }

      setSelectedSession(result);
    } catch (e) {
      setSessionDetailError(e.message);
    } finally {
      setSessionDetailLoading(false);
    }
  }, []);

  const loadLearningSessions = useCallback(async () => {
    setLearningLoading(true);
    setLearningError("");

    try {
      const result = await api("/learning");
      setLearningSessions(Array.isArray(result) ? result : []);
    } catch (e) {
      setLearningError(e.message);
    } finally {
      setLearningLoading(false);
    }
  }, []);

  const loadEnrollments = useCallback(async () => {
    setDataLoading(true);
    try {
      const result = await api("/enrollments");
      setEnrollments(
        Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [],
      );
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    api("/auth/me")
      .then(({ user: current }) => {
        if (!alive) return;

        setUser(current);
        setProfileName(current.fullName || "");

        return api("/enrollments").then((result) => {
          if (!alive) return;

          setEnrollments(
            Array.isArray(result?.data)
              ? result.data
              : Array.isArray(result)
                ? result
                : [],
          );

          return api("/learning")
            .then((learningResult) => {
              if (!alive) return;

              setLearningSessions(
                Array.isArray(learningResult?.data)
                  ? learningResult.data
                  : Array.isArray(learningResult)
                    ? learningResult
                    : [],
              );

              setLearningError("");
            })
            .catch((e) => {
              if (alive) setLearningError(e.message);
            });
        });
      })
      .catch((e) => {
        if (alive && !/sign in|session|authentication/i.test(e.message)) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const paymentRows = useMemo(
    () =>
      enrollments.flatMap((enrollment) =>
        (enrollment.payments || []).map((payment) => ({
          ...payment,
          enrollment,
        })),
      ),
    [enrollments],
  );

  function navigate(id) {
    setActivePage(id);
    setMobileNavOpen(false);
    setNotice("");
    setError("");
    window.history.replaceState(
      {},
      "",
      id === "dashboard" ? "/student" : `/student/${id}`,
    );
  }
  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setError("");
    setNotice("");
    try {
      const payload =
        authMode === "register"
          ? {
              fullName: auth.fullName,
              email: auth.email,
              password: auth.password,
            }
          : { email: auth.email, password: auth.password };
      const result = await api(
        `/auth/${authMode === "register" ? "register" : "login"}`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      setUser(result.user);
      setProfileName(result.user.fullName || "");
      setAuth({ fullName: "", email: "", password: "" });
      setEnrollments([]);
      await loadEnrollments();
      await loadLearningSessions();
      setNotice("You are signed in.");
    } catch (e) {
      setError(e.message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function signOut() {
    setError("");
    setNotice("");
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {
      setError(e.message);
      return;
    }
    setUser(null);
    setEnrollments([]);
    setAuth({ fullName: "", email: "", password: "" });
    setAuthMode("login");
    setLearningSessions([]);
  }
  async function saveProfile(event) {
    event.preventDefault();
    setProfileBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/profile", {
        method: "PATCH",
        body: JSON.stringify({ fullName: profileName }),
      });
      setUser(result.user);
      setProfileName(result.user.fullName);
      setNotice("Your profile was updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setProfileBusy(false);
    }
  }
  async function requestPasswordReset(event) {
    event.preventDefault();
    setResetBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await api("/password-reset", {
        method: "POST",
        body: JSON.stringify({ email: resetEmail }),
      });

      setNotice(
        result?.message ||
          "If an eligible account exists for that email, a password reset link will be sent.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setResetBusy(false);
    }
  }

  async function confirmPasswordReset(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      setError(
        "The reset link is missing its token. Please request a new link.",
      );
      return;
    }

    if (resetPassword !== resetPasswordConfirm) {
      setError("The passwords do not match.");
      return;
    }

    if (resetPassword.length < 10 || resetPassword.length > 128) {
      setError("Your password must contain between 10 and 128 characters.");
      return;
    }

    setResetBusy(true);

    try {
      const result = await api("/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({
          token,
          password: resetPassword,
        }),
      });

      setNotice(
        result?.message || "Your password has been reset. You can now sign in.",
      );

      setResetPassword("");
      setResetPasswordConfirm("");

      window.history.replaceState({}, "", "/student");
      setPasswordResetMode("");
      setAuthMode("login");
    } catch (e) {
      setError(e.message);
    } finally {
      setResetBusy(false);
    }
  }

  function returnToSignIn() {
    setPasswordResetMode("");
    setAuthMode("login");
    setError("");
    setNotice("");
    window.history.replaceState({}, "", "/student");
  }
  if (passwordResetMode) {
    const isConfirmation = passwordResetMode === "confirm";

    return (
      <div className="student-auth-screen">
        <div className="student-auth-card">
          <StudentBrand />

          <p className="student-eyebrow">
            <span /> ACCOUNT SECURITY
          </p>

          <h1>
            {isConfirmation ? "Choose a new password." : "Reset your password."}
          </h1>

          <p className="student-auth-intro">
            {isConfirmation
              ? "Create a new password to regain access to your student account."
              : "Enter your email address and we will send you a reset link if an eligible account exists."}
          </p>

          {error && (
            <div className="student-alert" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="student-notice" role="status">
              {notice}
            </div>
          )}

          {isConfirmation ? (
            <form onSubmit={confirmPasswordReset} className="student-auth-form">
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={128}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                />
                <small>Use between 10 and 128 characters.</small>
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={128}
                  value={resetPasswordConfirm}
                  onChange={(event) =>
                    setResetPasswordConfirm(event.target.value)
                  }
                />
              </label>

              <button className="student-primary-button" disabled={resetBusy}>
                {resetBusy ? "Please wait…" : "Reset password"} <span>→</span>
              </button>
            </form>
          ) : (
            <form onSubmit={requestPasswordReset} className="student-auth-form">
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={191}
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                />
              </label>

              <button className="student-primary-button" disabled={resetBusy}>
                {resetBusy ? "Sending…" : "Send reset link"} <span>→</span>
              </button>
            </form>
          )}

          <p className="student-auth-switch">
            Remembered your password?{" "}
            <button type="button" onClick={returnToSignIn}>
              Sign in
            </button>
          </p>

          <a className="student-back-link" href="/">
            ← Back to Solyce website
          </a>
        </div>
      </div>
    );
  }
  if (loading)
    return (
      <div className="student-auth-screen">
        <div className="student-auth-card">
          <StudentBrand />
          <p>Checking your student session…</p>
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="student-auth-screen">
        <div className="student-auth-card">
          <StudentBrand />
          <p className="student-eyebrow">
            <span /> YOUR LEARNING SPACE
          </p>
          <h1>
            {authMode === "login" ? "Welcome back." : "Start your journey."}
          </h1>
          <p className="student-auth-intro">
            {authMode === "login"
              ? "Sign in to access your Solyce student account."
              : "Create a student account to manage your learning."}
          </p>
          {error && (
            <div className="student-alert" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submitAuth} className="student-auth-form">
            {authMode === "register" && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  required
                  minLength="2"
                  maxLength="150"
                  value={auth.fullName}
                  onChange={(e) =>
                    setAuth({ ...auth, fullName: e.target.value })
                  }
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                maxLength="191"
                value={auth.email}
                onChange={(e) => setAuth({ ...auth, email: e.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={authMode === "register" ? 10 : 1}
                maxLength="128"
                value={auth.password}
                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              />
              {authMode === "register" && (
                <small>Use at least 10 characters.</small>
              )}
            </label>
            {authMode === "login" && (
              <p className="student-auth-switch">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordResetMode("request");
                    setResetEmail(auth.email);
                    setError("");
                    setNotice("");
                  }}
                >
                  Forgot your password?
                </button>
              </p>
            )}
            <button className="student-primary-button" disabled={authBusy}>
              {authBusy
                ? "Please wait…"
                : authMode === "login"
                  ? "Sign in"
                  : "Create account"}{" "}
              <span>→</span>
            </button>
          </form>
          <p className="student-auth-switch">
            {authMode === "login"
              ? "New to Solyce?"
              : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setError("");
              }}
              type="button"
            >
              {authMode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <a className="student-back-link" href="/">
            ← Back to Solyce website
          </a>
        </div>
      </div>
    );

  const activeCount = enrollments.filter(
    (enrollment) => !["CANCELLED", "WAITLISTED"].includes(enrollment.status),
  ).length;
  const currentLetter =
    (user.fullName || "S").trim().charAt(0).toUpperCase() || "S";
  const refreshButton = (
    <button
      type="button"
      className="student-inline-link"
      onClick={loadEnrollments}
      disabled={dataLoading}
    >
      {dataLoading ? "Refreshing…" : "Refresh ↻"}
    </button>
  );

  return (
    <div className="student-app student-phase2-auth">
      <aside className={`student-sidebar${mobileNavOpen ? " is-open" : ""}`}>
        <div className="student-sidebar-top">
          <StudentBrand />
          <button
            className="student-mobile-close"
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>
        <div className="student-profile-mini">
          <div className="student-avatar">{currentLetter}</div>
          <div>
            <strong>{user.fullName}</strong>
            <span>Student account</span>
          </div>
        </div>
        <nav className="student-navigation" aria-label="Student navigation">
          {["LEARNING", "ACCOUNT"].map((group) => (
            <div className="student-nav-group" key={group}>
              <p>{group}</p>
              {navigation
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`student-nav-item${activePage === item.id ? " active" : ""}`}
                    onClick={() => navigate(item.id)}
                  >
                    <span className="student-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="student-sidebar-bottom">
          <div className="student-help-card">
            <span className="student-help-symbol">?</span>
            <strong>Need a hand?</strong>
            <p>
              Have a question about an enrolment or an earlier guest booking?
            </p>
            <button type="button" onClick={() => navigate("support")}>
              Visit support <span>↗</span>
            </button>
          </div>
          <button type="button" className="student-signout" onClick={signOut}>
            <span>↪</span> Sign out
          </button>
        </div>
      </aside>
      {mobileNavOpen && (
        <button
          className="student-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <main className="student-main">
        <header className="student-topbar">
          <button
            className="student-menu-toggle"
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <div className="student-breadcrumb">
            Student portal <span>/</span>{" "}
            <strong>
              {activePage === "dashboard"
                ? "Dashboard"
                : navigation.find((item) => item.id === activePage)?.label}
            </strong>
          </div>
          <div className="student-top-actions">
            <span className="student-date-label">YOUR LEARNING SPACE</span>
            <div className="student-top-avatar">{currentLetter}</div>
          </div>
        </header>
        <div className="student-content">
          {error && (
            <div className="student-alert student-alert-wide" role="alert">
              {error}{" "}
              <button type="button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {notice && (
            <div className="student-notice" role="status">
              {notice}
            </div>
          )}
          {activePage === "dashboard" ? (
            <>
              <section className="student-welcome">
                <div>
                  <p className="student-eyebrow">
                    <span /> YOUR NEXT CHAPTER
                  </p>
                  <h1>
                    Make progress,
                    <br />
                    <em>one step at a time.</em>
                  </h1>
                  <p className="student-welcome-copy">
                    Welcome, {user.fullName}. Your student space shows
                    information linked to your account.
                  </p>
                  <div className="student-welcome-actions">
                    <button
                      type="button"
                      className="student-primary-button"
                      onClick={() => navigate("courses")}
                    >
                      Explore my learning <span>↗</span>
                    </button>
                    <button
                      type="button"
                      className="student-text-button"
                      onClick={() => navigate("payments")}
                    >
                      View payments <span>→</span>
                    </button>
                  </div>
                </div>
                <div className="student-welcome-art">
                  <div className="student-art-ring ring-one" />
                  <div className="student-art-ring ring-two" />
                  <div className="student-art-core">
                    S<span>.</span>
                  </div>
                  <span className="student-art-label art-label-one">
                    01 / CLARITY
                  </span>
                  <span className="student-art-label art-label-two">
                    02 / PRACTICE
                  </span>
                  <span className="student-art-label art-label-three">
                    03 / PROGRESS
                  </span>
                  <span className="student-art-cross">+</span>
                </div>
              </section>
              <section
                className="student-stat-grid"
                aria-label="Learning overview"
              >
                <article className="student-stat-card">
                  <div className="student-stat-top">
                    <span>LINKED ENROLMENTS</span>
                    <span className="student-stat-icon">▤</span>
                  </div>
                  <strong>{enrollments.length}</strong>
                  <p>Records connected to your account</p>
                </article>
                <article className="student-stat-card">
                  <div className="student-stat-top">
                    <span>ACTIVE PROGRAMS</span>
                    <span className="student-stat-icon">↗</span>
                  </div>
                  <strong>{activeCount}</strong>
                  <p>Enrolments not cancelled or waitlisted</p>
                </article>
                <article className="student-stat-card">
                  <div className="student-stat-top">
                    <span>PAYMENT RECORDS</span>
                    <span className="student-stat-icon">◇</span>
                  </div>
                  <strong>{paymentRows.length}</strong>
                  <p>Actual records from linked enrolments</p>
                </article>
                <article className="student-stat-card">
                  <div className="student-stat-top">
                    <span>TO-DO</span>
                    <span className="student-stat-icon">✓</span>
                  </div>
                  <strong>—</strong>
                  <p>Assignment tools are not available yet</p>
                </article>
              </section>
              <section className="student-dashboard-grid">
                <div className="student-panel student-program-panel">
                  <div className="student-panel-heading">
                    <div>
                      <p className="student-eyebrow">YOUR JOURNEY</p>
                      <h2>Your enrolments</h2>
                    </div>
                    {refreshButton}
                  </div>
                  {dataLoading ? (
                    <EmptyState title="Loading your records">
                      Please wait while your enrolments are refreshed.
                    </EmptyState>
                  ) : enrollments.length ? (
                    enrollments.slice(0, 4).map((e) => (
                      <div className="student-record" key={e.id}>
                        <div>
                          <strong>
                            {e.cohort?.course?.title ||
                              e.cohort?.name ||
                              "Solyce program"}
                          </strong>
                          <span>
                            {e.cohort?.name} · {statusLabel(e.status)}
                          </span>
                        </div>
                        <b>{money(e.agreedPriceXaf)}</b>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No linked enrolments yet">
                      Only enrolments securely linked to your account appear
                      here. If you previously booked as a guest, contact the
                      Solyce team to request assistance. A matching email or
                      booking reference alone does not automatically link a
                      booking.
                    </EmptyState>
                  )}
                </div>
                <div className="student-panel student-agenda-panel">
                  <div className="student-panel-heading">
                    <div>
                      <p className="student-eyebrow">KEEP ON TRACK</p>
                      <h2>Next cohort dates</h2>
                    </div>
                    {refreshButton}
                  </div>
                  {enrollments.length ? (
                    enrollments.slice(0, 4).map((e) => (
                      <div className="student-record compact" key={e.id}>
                        <div>
                          <strong>{e.cohort?.name || "Cohort"}</strong>
                          <span>
                            {date(e.cohort?.startDate)} –{" "}
                            {date(e.cohort?.endDate)}
                          </span>
                        </div>
                        <b>{statusLabel(e.cohort?.status)}</b>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="Nothing scheduled yet">
                      Your cohort dates will appear when a linked enrolment
                      exists. Live session scheduling is not yet available.
                    </EmptyState>
                  )}
                </div>
              </section>
              <section className="student-bottom-grid">
                <div className="student-tip-card">
                  <div className="student-tip-mark">✳</div>
                  <div>
                    <p className="student-eyebrow">THE SOLYCE METHOD</p>
                    <h2>
                      Small, consistent steps
                      <br />
                      create meaningful progress.
                    </h2>
                    <p>
                      Return regularly, practise deliberately and keep your
                      learning goals in sight.
                    </p>
                  </div>
                  <span className="student-tip-index">01 — 03</span>
                </div>
                <div className="student-panel student-quick-panel">
                  <p className="student-eyebrow">QUICK ACCESS</p>
                  <button type="button" onClick={() => navigate("courses")}>
                    <span>▧</span> My enrolments <b>→</b>
                  </button>
                  <button type="button" onClick={() => navigate("payments")}>
                    <span>◇</span> Payment details <b>→</b>
                  </button>
                  <button type="button" onClick={() => navigate("profile")}>
                    <span>○</span> My profile <b>→</b>
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="student-page-heading">
                <p className="student-eyebrow">
                  <span /> {currentPage.eyebrow}
                </p>
                <h1>{currentPage.title}</h1>
                <p>{currentPage.description}</p>
              </div>
              {activePage === "profile" ? (
                <div className="student-panel student-profile-notice">
                  <div className="student-avatar large">{currentLetter}</div>
                  <form className="student-profile-form" onSubmit={saveProfile}>
                    <h2>Your student profile</h2>
                    <label>
                      Full name
                      <input
                        required
                        minLength="2"
                        maxLength="150"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                      />
                    </label>
                    <p>
                      Email: {user.email} (email changes are not available here)
                    </p>
                    <button
                      className="student-primary-button"
                      disabled={profileBusy}
                    >
                      {profileBusy ? "Saving…" : "Save profile"} <span>→</span>
                    </button>
                  </form>
                </div>
              ) : activePage === "courses" ? (
                <div className="student-panel student-subpage-panel">
                  {enrollments.length ? (
                    enrollments.map((e) => (
                      <div className="student-record" key={e.id}>
                        <div>
                          <strong>{e.cohort?.course?.title || "Course"}</strong>
                          <span>
                            {e.cohort?.name} ·{" "}
                            {e.cohort?.course?.language || ""} ·{" "}
                            {statusLabel(e.status)}
                          </span>
                          <small>
                            {date(e.cohort?.startDate)} –{" "}
                            {date(e.cohort?.endDate)} ·{" "}
                            {e.cohort?.scheduleDescription}
                          </small>
                        </div>
                        <b>{money(e.agreedPriceXaf)}</b>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="Your programs will appear here">
                      There are no enrolments linked to this account yet.
                      Previous guest bookings require assistance from the Solyce
                      team.
                    </EmptyState>
                  )}
                </div>
              ) : activePage === "schedule" ? (
                <div className="student-panel student-subpage-panel">
                  {selectedSession ? (
                    <>
                      <button
                        type="button"
                        className="student-text-button"
                        onClick={() => setSelectedSession(null)}
                        disabled={sessionDetailLoading}
                        style={{ color: "var(--st-ink)", marginBottom: 20 }}
                      >
                        ← Back to schedule
                      </button>

                      <p className="student-eyebrow">YOUR LEARNING SESSION</p>
                      <h2>
                        {selectedSession.lesson?.title || "Learning session"}
                      </h2>

                      <p>
                        {selectedSession.cohort?.course?.title ||
                          "Solyce course"}
                        {" · "}
                        {selectedSession.lesson?.module?.title ||
                          "Course lesson"}
                      </p>

                      <div className="student-record">
                        <div>
                          <strong>Session schedule</strong>
                          <span>
                            Starts: {dateTime(selectedSession.scheduledAt)}
                          </span>
                          <span>
                            Ends: {dateTime(selectedSession.scheduledEndAt)}
                          </span>
                          <small>
                            Access: {statusLabel(selectedSession.accessPhase)}
                          </small>
                        </div>
                        <b>{statusLabel(selectedSession.status)}</b>
                      </div>

                      {selectedSession.lesson?.description && (
                        <section style={{ marginTop: 24 }}>
                          <h3>About this lesson</h3>
                          <p>{selectedSession.lesson.description}</p>
                        </section>
                      )}

                      {Array.isArray(selectedSession.lesson?.objectives) &&
                        selectedSession.lesson.objectives.length > 0 && (
                          <section style={{ marginTop: 24 }}>
                            <h3>Learning objectives</h3>
                            <ul>
                              {selectedSession.lesson.objectives.map(
                                (objective, index) => (
                                  <li key={`${index}-${objective}`}>
                                    {typeof objective === "string"
                                      ? objective
                                      : objective.title ||
                                        objective.text ||
                                        JSON.stringify(objective)}
                                  </li>
                                ),
                              )}
                            </ul>
                          </section>
                        )}

                      {selectedSession.accessPhase === "LOCKED" ? (
                        <div style={{ marginTop: 24 }}>
                          <h3>Preparation</h3>
                          <p>
                            Your preparation materials and meeting link will
                            become available when the preparation period opens.
                          </p>
                        </div>
                      ) : (
                        <>
                          {selectedSession.meetingUrl && (
                            <section style={{ marginTop: 24 }}>
                              <h3>Live class</h3>
                              <p>
                                Platform:{" "}
                                {statusLabel(
                                  selectedSession.meetingProvider ||
                                    "Online meeting",
                                )}
                              </p>
                              <a
                                className="student-primary-button"
                                href={selectedSession.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Join live class ↗
                              </a>
                            </section>
                          )}

                          {selectedSession.preparationContent && (
                            <section style={{ marginTop: 24 }}>
                              <h3>Preparation guide</h3>
                              <div
                                style={{
                                  whiteSpace: "pre-wrap",
                                  lineHeight: 1.8,
                                }}
                              >
                                {selectedSession.preparationContent}
                              </div>
                            </section>
                          )}

                          {selectedSession.accessPhase === "AFTER_SESSION" &&
                            selectedSession.content && (
                              <section style={{ marginTop: 24 }}>
                                <h3>Lesson content</h3>
                                <div
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.8,
                                  }}
                                >
                                  {selectedSession.content}
                                </div>
                              </section>
                            )}

                          {selectedSession.accessPhase === "AFTER_SESSION" &&
                            selectedSession.instructorNotes && (
                              <section style={{ marginTop: 24 }}>
                                <h3>Instructor notes</h3>
                                <div
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    lineHeight: 1.8,
                                  }}
                                >
                                  {selectedSession.instructorNotes}
                                </div>
                              </section>
                            )}

                          <section style={{ marginTop: 24 }}>
                            <h3>Available resources</h3>

                            {selectedSession.resources?.length ? (
                              selectedSession.resources.map((resource) => (
                                <article
                                  className="student-record"
                                  key={resource.id}
                                >
                                  <div>
                                    <strong>{resource.title}</strong>
                                    {resource.description && (
                                      <span>{resource.description}</span>
                                    )}
                                    <small>
                                      {statusLabel(resource.resourceType)}
                                    </small>
                                  </div>
                                  {resource.url && (
                                    <a
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Open ↗
                                    </a>
                                  )}
                                </article>
                              ))
                            ) : (
                              <p>
                                No resources are available during this phase.
                              </p>
                            )}
                          </section>

                          <section style={{ marginTop: 24 }}>
                            <h3>Assessments</h3>

                            {selectedSession.assessments?.length ? (
                              selectedSession.assessments.map((assessment) => (
                                <article
                                  className="student-record"
                                  key={assessment.id}
                                >
                                  <div>
                                    <strong>{assessment.title}</strong>
                                    {assessment.description && (
                                      <span>{assessment.description}</span>
                                    )}
                                    <small>
                                      {statusLabel(assessment.assessmentType)}
                                    </small>
                                  </div>
                                  <button
                                    type="button"
                                    className="student-inline-link"
                                    onClick={() => navigate("assignments")}
                                  >
                                    Go to assessments →
                                  </button>
                                </article>
                              ))
                            ) : (
                              <p>
                                No assessments are available during this phase.
                              </p>
                            )}
                          </section>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="student-panel-heading">
                        <div>
                          <p className="student-eyebrow">YOUR LIVE CLASSES</p>
                          <h2>Scheduled lessons</h2>
                        </div>
                        <button
                          type="button"
                          className="student-inline-link"
                          onClick={loadLearningSessions}
                          disabled={learningLoading}
                        >
                          {learningLoading ? "Refreshing…" : "Refresh ↻"}
                        </button>
                      </div>
                      {sessionDetailError && (
                        <div className="student-alert" role="alert">
                          <div>
                            <strong>We couldn't load this lesson.</strong>
                            <p>{sessionDetailError}</p>
                            <button
                              type="button"
                              className="student-inline-link"
                              onClick={() => {
                                if (requestedSessionId !== null) {
                                  loadSessionDetail(requestedSessionId);
                                }
                              }}
                              disabled={
                                sessionDetailLoading ||
                                requestedSessionId === null
                              }
                            >
                              Try again ↻
                            </button>
                          </div>
                        </div>
                      )}
                      {learningLoading ? (
                        <EmptyState title="Loading your schedule">
                          Your scheduled lessons are being retrieved.
                        </EmptyState>
                      ) : learningSessions.length === 0 ? (
                        <EmptyState title="No lessons scheduled yet">
                          Scheduled lessons for your confirmed enrolments will
                          appear here.
                        </EmptyState>
                      ) : (
                        learningSessions.map((session) => (
                          <article className="student-record" key={session.id}>
                            <div>
                              <strong>
                                {session.lesson?.title || "Scheduled lesson"}
                              </strong>
                              <span>
                                {session.cohort?.course?.title ||
                                  session.cohort?.name}
                                {" · "}
                                {session.lesson?.module?.title ||
                                  "Course lesson"}
                              </span>
                              <small>
                                Starts: {dateTime(session.scheduledAt)}
                                {" · "}
                                Ends: {dateTime(session.scheduledEndAt)}
                              </small>
                              <small>
                                Access: {statusLabel(session.accessPhase)}
                              </small>

                              {session.accessPhase === "LOCKED" ? (
                                <small>
                                  The meeting link will become available when
                                  the preparation period opens.
                                </small>
                              ) : session.meetingUrl ? (
                                <a
                                  href={session.meetingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Join{" "}
                                  {statusLabel(
                                    session.meetingProvider || "online meeting",
                                  )}{" "}
                                  ↗
                                </a>
                              ) : (
                                <small>
                                  The instructor has not added a meeting link
                                  yet.
                                </small>
                              )}

                              <button
                                type="button"
                                className="student-inline-link"
                                disabled={sessionDetailLoading}
                                onClick={() => loadSessionDetail(session.id)}
                              >
                                View lesson details →
                              </button>
                            </div>
                            <b>{statusLabel(session.status)}</b>
                          </article>
                        ))
                      )}

                      {sessionDetailLoading && (
                        <p role="status">Loading lesson details…</p>
                      )}
                    </>
                  )}
                </div>
              ) : activePage === "resources" ? (
                <div className="student-panel student-subpage-panel">
                  <div className="student-panel-heading">
                    <div>
                      <p className="student-eyebrow">YOUR COURSE MATERIALS</p>
                      <h2>Resources library</h2>
                    </div>
                    <button
                      type="button"
                      className="student-inline-link"
                      onClick={loadLearningSessions}
                      disabled={learningLoading}
                    >
                      {learningLoading ? "Refreshing…" : "Refresh ↻"}
                    </button>
                  </div>

                  {learningLoading ? (
                    <EmptyState title="Loading your resources">
                      Your available course materials are being retrieved.
                    </EmptyState>
                  ) : learningError ? (
                    <div className="student-alert" role="alert">
                      <div>
                        <strong>We couldn't load your resources.</strong>
                        <p>{learningError}</p>
                        <button
                          type="button"
                          className="student-inline-link"
                          onClick={loadLearningSessions}
                          disabled={learningLoading}
                        >
                          Try again ↻
                        </button>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const sessionsWithResources = learningSessions.filter(
                        (session) =>
                          Array.isArray(session.resources) &&
                          session.resources.length > 0,
                      );

                      if (sessionsWithResources.length === 0) {
                        return (
                          <EmptyState title="Your library is not ready yet">
                            Resources will appear here when your instructor
                            publishes materials and your access period opens.
                            You can also check your scheduled lessons for
                            preparation guides and lesson details.
                          </EmptyState>
                        );
                      }

                      return sessionsWithResources.map((session) => (
                        <section key={session.id} style={{ marginBottom: 28 }}>
                          <div style={{ marginBottom: 14 }}>
                            <h3 style={{ marginBottom: 5 }}>
                              {session.lesson?.title || "Learning session"}
                            </h3>
                            <p style={{ margin: 0 }}>
                              {session.cohort?.course?.title ||
                                session.cohort?.name ||
                                "Solyce course"}
                              {" · "}
                              {dateTime(session.scheduledAt)}
                            </p>
                          </div>

                          {session.resources.map((resource) => (
                            <article
                              className="student-record"
                              key={`${session.id}-${resource.id}`}
                            >
                              <div>
                                <strong>{resource.title}</strong>

                                {resource.description && (
                                  <span>{resource.description}</span>
                                )}

                                <small>
                                  {statusLabel(resource.resourceType)}
                                  {" · "}
                                  {statusLabel(resource.releasePhase)}
                                </small>
                              </div>

                              {resource.url ? (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Open resource ↗
                                </a>
                              ) : (
                                <small>Link unavailable</small>
                              )}
                            </article>
                          ))}

                          <button
                            type="button"
                            className="student-inline-link"
                            onClick={() => {
                              navigate("schedule");
                              loadSessionDetail(session.id);
                            }}
                          >
                            View lesson details →
                          </button>
                        </section>
                      ));
                    })()
                  )}
                </div>
              ) : activePage === "payments" ? (
                <div className="student-panel student-subpage-panel">
                  {paymentRows.length ? (
                    paymentRows.map((p) => (
                      <div className="student-record" key={p.id}>
                        <div>
                          <strong>
                            {p.enrollment?.cohort?.course?.title ||
                              p.enrollment?.cohort?.name ||
                              "Enrolment payment"}
                          </strong>
                          <span>
                            {statusLabel(p.status)} · {statusLabel(p.method)} ·
                            Expected {money(p.expectedAmountXaf)}
                          </span>
                          <small>
                            Received: {money(p.receivedAmountXaf)} · Reference:{" "}
                            {p.transactionReference || "Not provided"} ·
                            Recorded {date(p.createdAt)}
                          </small>
                        </div>
                        <b>{money(p.receivedAmountXaf)}</b>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No payment records yet">
                      Payment history is shown only for enrolments linked to
                      your account.
                    </EmptyState>
                  )}
                </div>
              ) : activePage === "support" ? (
                <div className="student-panel student-subpage-panel">
                  <EmptyState title="Contact the Solyce team">
                    If you booked as a guest before creating your account,
                    contact Solyce directly through the contact details on the
                    public website. The platform does not automatically claim
                    guest bookings based on email or booking reference.
                  </EmptyState>
                </div>
              ) : activePage === "assignments" ? (
                <StudentAssessments />
              ) : (
                <div className="student-panel student-subpage-panel">
                  <EmptyState title="Your learning library is being prepared">
                    Learning resources and recordings are not yet supported by
                    the current interface.
                  </EmptyState>
                </div>
              )}
            </>
          )}
        </div>
        <footer className="student-footer">
          <span>© {new Date().getFullYear()} Solyce Learning</span>
          <span>Purposeful learning. Meaningful progress.</span>
          <button type="button" onClick={() => navigate("support")}>
            Need help?
          </button>
        </footer>
      </main>
    </div>
  );
}
