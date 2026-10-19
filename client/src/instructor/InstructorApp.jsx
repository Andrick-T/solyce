import { useCallback, useEffect, useState } from "react";
import "./InstructorApp.css";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api/instructor${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body?.error?.message || "Something went wrong. Please try again.",
    );
  }

  return body?.data;
}

function Brand() {
  return (
    <a className="instructor-brand" href="/instructor">
      <span className="instructor-brand-mark">S.</span>
      <span>
        solyce<span className="instructor-brand-dot">.</span>
      </span>
    </a>
  );
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not scheduled"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

export default function InstructorApp() {
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    const result = await api("/dashboard");
    setUser(result.user);
    setDashboard(result);
  }, []);

  useEffect(() => {
    let alive = true;

    async function initialize() {
      try {
        const result = await api("/auth/me");

        if (!alive) return;

        setUser(result.user);
        const dashboardResult = await api("/dashboard");

        if (alive) setDashboard(dashboardResult);
      } catch {
        // No active instructor session; show the login screen.
      } finally {
        if (alive) setLoading(false);
      }
    }

    initialize();

    return () => {
      alive = false;
    };
  }, []);

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setUser(result.user);
      setPassword("");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError("");

    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setDashboard(null);
      setPassword("");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <div className="instructor-auth-screen">
        <div className="instructor-auth-card">
          <Brand />
          <p>Checking your instructor session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="instructor-auth-screen">
        <section className="instructor-auth-card">
          <Brand />
          <p className="instructor-eyebrow">INSTRUCTOR WORKSPACE</p>
          <h1>Teach with purpose.</h1>
          <p className="instructor-muted">
            Sign in with the instructor account provided by your Solyce
            administrator.
          </p>

          {error && (
            <div className="instructor-alert" role="alert">
              {error}
            </div>
          )}

          <form className="instructor-login-form" onSubmit={signIn}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                maxLength={191}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <button className="instructor-primary-button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in to your workspace"}{" "}
              <span>→</span>
            </button>
          </form>

          <a className="instructor-back-link" href="/">
            ← Back to Solyce
          </a>
        </section>
      </div>
    );
  }

  const stats = dashboard?.stats || {
    assignedCohorts: 0,
    activeCohorts: 0,
    confirmedStudents: 0,
    programs: 0,
  };

  return (
    <div className="instructor-app">
      <aside className="instructor-sidebar">
        <Brand />

        <div className="instructor-profile">
          <div className="instructor-avatar">
            {(user.fullName || "I").trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user.fullName}</strong>
            <span>Instructor</span>
          </div>
        </div>

        <p className="instructor-nav-label">WORKSPACE</p>
        <a className="instructor-nav-link active" href="/instructor">
          <span>▦</span> Overview
        </a>
        <div className="instructor-nav-link disabled">
          <span>▤</span> My programs
          <small>Coming next</small>
        </div>
        <div className="instructor-nav-link disabled">
          <span>◷</span> My cohorts
        </div>
        <div className="instructor-nav-link disabled">
          <span>✓</span> Assessments
        </div>

        <div className="instructor-sidebar-bottom">
          <div className="instructor-help-card">
            <strong>Build meaningful learning.</strong>
            <p>Your teaching workspace, all in one place.</p>
          </div>
          <button className="instructor-signout" onClick={signOut}>
            ↪ Sign out
          </button>
          <a className="instructor-back-link" href="/">
            ← Public website
          </a>
        </div>
      </aside>

      <main className="instructor-main">
        <header className="instructor-topbar">
          <div>
            <span>INSTRUCTOR PORTAL</span>
            <strong>Workspace / Overview</strong>
          </div>
          <div className="instructor-top-user">
            <span>{user.fullName}</span>
            <div className="instructor-avatar small">
              {(user.fullName || "I").trim().charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="instructor-content">
          {error && (
            <div className="instructor-alert" role="alert">
              {error}
            </div>
          )}

          <section className="instructor-welcome">
            <div>
              <p className="instructor-eyebrow">YOUR TEACHING SPACE</p>
              <h1>
                Welcome back,
                <br />
                <em>{user.fullName.split(" ")[0]}.</em>
              </h1>
              <p>
                Manage your assigned cohorts and follow your students' learning
                journey from one workspace.
              </p>
            </div>
            <div className="instructor-welcome-art" aria-hidden="true">
              <div className="instructor-art-ring ring-a" />
              <div className="instructor-art-ring ring-b" />
              <div className="instructor-art-core">
                S<span>.</span>
              </div>
              <span className="instructor-art-caption">
                TEACH · GUIDE · GROW
              </span>
            </div>
          </section>

          <div className="instructor-section-heading">
            <div>
              <p className="instructor-eyebrow">AT A GLANCE</p>
              <h2>Your teaching overview</h2>
            </div>
            <button
              className="instructor-refresh"
              onClick={() => {
                setError("");
                loadDashboard().catch((err) => setError(err.message));
              }}
            >
              ↻ Refresh
            </button>
          </div>

          <section className="instructor-stat-grid">
            <article className="instructor-stat-card">
              <span>ASSIGNED PROGRAMS</span>
              <strong>{stats.programs}</strong>
              <p>Programs linked to your cohorts</p>
            </article>
            <article className="instructor-stat-card">
              <span>MY COHORTS</span>
              <strong>{stats.assignedCohorts}</strong>
              <p>All assigned cohorts</p>
            </article>
            <article className="instructor-stat-card">
              <span>ACTIVE COHORTS</span>
              <strong>{stats.activeCohorts}</strong>
              <p>Open or currently running</p>
            </article>
            <article className="instructor-stat-card">
              <span>CONFIRMED STUDENTS</span>
              <strong>{stats.confirmedStudents}</strong>
              <p>Across your assigned cohorts</p>
            </article>
          </section>

          <section className="instructor-panel">
            <div className="instructor-panel-heading">
              <div>
                <p className="instructor-eyebrow">YOUR CLASSES</p>
                <h2>Assigned cohorts</h2>
              </div>
              <span>{dashboard?.cohorts?.length || 0} total</span>
            </div>

            {!dashboard?.cohorts?.length ? (
              <div className="instructor-empty">
                <span>▤</span>
                <h3>Your teaching journey starts here.</h3>
                <p>
                  No cohorts have been assigned to you yet. Once the
                  administrator assigns a cohort, it will appear here.
                </p>
              </div>
            ) : (
              <div className="instructor-table-wrap">
                <table className="instructor-table">
                  <thead>
                    <tr>
                      <th>COHORT / PROGRAM</th>
                      <th>SCHEDULE</th>
                      <th>STUDENTS</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.cohorts.map((cohort) => (
                      <tr key={cohort.id}>
                        <td>
                          <strong>{cohort.name}</strong>
                          <span>{cohort.course.title}</span>
                        </td>
                        <td>
                          <strong>{formatDate(cohort.startDate)}</strong>
                          <span>{cohort.scheduleDescription}</span>
                        </td>
                        <td>
                          <strong>
                            {cohort.confirmedStudents} / {cohort.capacity}
                          </strong>
                          <span>confirmed students</span>
                        </td>
                        <td>
                          <span
                            className={`instructor-status status-${cohort.status.toLowerCase()}`}
                          >
                            {label(cohort.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="instructor-footer">
            <span>
              © {new Date().getFullYear()} Solyce · Instructor workspace
            </span>
            <span>Purposeful learning. Meaningful progress.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
