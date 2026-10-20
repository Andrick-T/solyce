import { useCallback, useEffect, useState } from "react";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path) {
  const response = await fetch(`${apiBase}/api/instructor${path}`, {
    credentials: "include",
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error?.message || "Unable to load cohort data.");
  }

  return body?.data;
}

function formatDate(value, includeTime = false) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
    timeZone: "Africa/Douala",
  }).format(date);
}

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());
}

export default function MyCohorts() {
  const [cohorts, setCohorts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCohorts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const dashboard = await request("/dashboard");
      setCohorts(dashboard?.cohorts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCohorts();
  }, [loadCohorts]);

  async function openCohort(id) {
    setDetailLoading(true);
    setError("");

    try {
      const cohort = await request(`/cohorts/${id}`);
      setSelected(cohort);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <section className="instructor-cohorts">
      <header className="instructor-programs-header">
        <div>
          <p className="instructor-eyebrow">TEACHING MANAGEMENT</p>
          <h1>{selected ? selected.name : "My cohorts"}</h1>
          <p className="instructor-programs-intro">
            View your assigned classes, follow student registrations and prepare
            for upcoming lessons.
          </p>
        </div>

        <button
          type="button"
          className="instructor-secondary-button"
          onClick={selected ? () => setSelected(null) : loadCohorts}
          disabled={loading || detailLoading}
        >
          {selected ? "← All cohorts" : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div className="instructor-alert" role="alert">
          {error}
        </div>
      )}

      {detailLoading && (
        <div className="instructor-programs-empty">Loading cohort details…</div>
      )}

      {!selected && !detailLoading && (
        <>
          <div className="instructor-programs-summary">
            <div>
              <h2>Your assigned classes</h2>
              <p>
                {cohorts.length} cohort{cohorts.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="instructor-programs-empty">
              Loading your cohorts…
            </div>
          ) : cohorts.length === 0 ? (
            <div className="instructor-programs-empty">
              <span className="instructor-programs-empty-icon">◷</span>
              <h3>No cohorts assigned yet</h3>
              <p>
                Cohorts assigned to you by the administrator will appear here.
              </p>
            </div>
          ) : (
            <div className="instructor-program-grid">
              {cohorts.map((cohort) => (
                <article className="instructor-program-card" key={cohort.id}>
                  <div className="instructor-program-card-top">
                    <span className="instructor-program-language">
                      {cohort.course?.language === "FRENCH"
                        ? "French"
                        : "English"}
                    </span>
                    <span
                      className={`instructor-status status-${cohort.status.toLowerCase()}`}
                    >
                      {label(cohort.status)}
                    </span>
                  </div>

                  <h3>{cohort.name}</h3>
                  <p className="instructor-program-category">
                    {cohort.course?.title}
                  </p>

                  <div className="instructor-program-metadata">
                    <span>{formatDate(cohort.startDate)}</span>
                    <span>
                      {cohort.confirmedStudents} / {cohort.capacity} students
                    </span>
                  </div>

                  <p className="instructor-program-footnote">
                    {cohort.scheduleDescription || "Schedule not specified"}
                  </p>

                  <button
                    type="button"
                    className="instructor-primary-button"
                    onClick={() => openCohort(cohort.id)}
                  >
                    View cohort details →
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {selected && !detailLoading && (
        <>
          <section className="instructor-panel">
            <div className="instructor-panel-heading">
              <div>
                <p className="instructor-eyebrow">COHORT OVERVIEW</p>
                <h2>{selected.course?.title}</h2>
              </div>
              <span
                className={`instructor-status status-${selected.status.toLowerCase()}`}
              >
                {label(selected.status)}
              </span>
            </div>

            <div className="instructor-cohort-facts">
              <div>
                <span>Start date</span>
                <strong>{formatDate(selected.startDate)}</strong>
              </div>
              <div>
                <span>End date</span>
                <strong>{formatDate(selected.endDate)}</strong>
              </div>
              <div>
                <span>Schedule</span>
                <strong>
                  {selected.scheduleDescription || "Not specified"}
                </strong>
              </div>
              <div>
                <span>Confirmed students</span>
                <strong>
                  {selected.confirmedStudents} / {selected.capacity}
                </strong>
              </div>
              <div>
                <span>Minimum students</span>
                <strong>{selected.minimumStudents}</strong>
              </div>
              <div>
                <span>Timezone</span>
                <strong>{selected.timezone || "Africa/Douala"}</strong>
              </div>
            </div>
          </section>

          <section className="instructor-panel">
            <div className="instructor-panel-heading">
              <div>
                <p className="instructor-eyebrow">CLASS ROSTER</p>
                <h2>Students</h2>
              </div>
              <span>{selected.enrollments?.length || 0} registrations</span>
            </div>

            {!selected.enrollments?.length ? (
              <div className="instructor-empty">
                <h3>No registrations yet</h3>
                <p>Student registrations will appear here.</p>
              </div>
            ) : (
              <div className="instructor-table-wrap">
                <table className="instructor-table">
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>EMAIL</th>
                      <th>REGISTRATION DATE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.enrollments.map((enrollment) => (
                      <tr key={enrollment.id}>
                        <td>
                          <strong>
                            {enrollment.student?.fullName || "Student"}
                          </strong>
                          <span>
                            {enrollment.student?.isGuest
                              ? "Guest registration"
                              : "Registered account"}
                          </span>
                        </td>
                        <td>{enrollment.student?.email || "—"}</td>
                        <td>{formatDate(enrollment.enrolledAt)}</td>
                        <td>
                          <span className="instructor-status">
                            {label(enrollment.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="instructor-panel">
            <div className="instructor-panel-heading">
              <div>
                <p className="instructor-eyebrow">TEACHING SCHEDULE</p>
                <h2>Scheduled lessons</h2>
              </div>
              <span>{selected.scheduledLessons?.length || 0} lessons</span>
            </div>

            {!selected.scheduledLessons?.length ? (
              <div className="instructor-empty">
                <h3>No lessons scheduled yet</h3>
                <p>
                  Scheduled lessons will appear here when they are added to this
                  cohort.
                </p>
              </div>
            ) : (
              <div className="instructor-table-wrap">
                <table className="instructor-table">
                  <thead>
                    <tr>
                      <th>DATE & TIME</th>
                      <th>LESSON</th>
                      <th>MODULE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.scheduledLessons.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <strong>
                            {formatDate(session.scheduledAt, true)}
                          </strong>
                          <span>
                            Until {formatDate(session.scheduledEndAt, true)}
                          </span>
                        </td>
                        <td>
                          <strong>{session.lesson?.title || "Lesson"}</strong>
                          <span>
                            {session.lesson?.description || "No description"}
                          </span>
                        </td>
                        <td>{session.lesson?.module?.title || "—"}</td>
                        <td>
                          <span className="instructor-status">
                            {label(session.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selected.scheduledLessons?.some(
              (session) => session.instructorNotes,
            ) && (
              <div className="instructor-cohort-notes">
                <h3>Instructor notes</h3>
                {selected.scheduledLessons
                  .filter((session) => session.instructorNotes)
                  .map((session) => (
                    <article key={session.id}>
                      <strong>{session.lesson?.title || "Lesson"}</strong>
                      <p className="instructor-preserved-content">
                        {session.instructorNotes}
                      </p>
                    </article>
                  ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
