import { useCallback, useEffect, useState } from "react";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const ATTENDANCE_STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
];

const MEETING_PROVIDERS = [
  { value: "GOOGLE_MEET", label: "Google Meet" },
  { value: "ZOOM", label: "Zoom" },
  { value: "WHATSAPP", label: "WhatsApp video" },
];

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}/api/instructor${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body?.error?.message || "The request could not be completed.",
    );
  }

  return body?.data ?? body;
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

function validMeetingUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function MeetingEditor({ session, onSaved }) {
  const [provider, setProvider] = useState(session.meetingProvider || "");
  const [url, setUrl] = useState(session.meetingUrl || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setProvider(session.meetingProvider || "");
    setUrl(session.meetingUrl || "");
  }, [session.meetingProvider, session.meetingUrl]);

  async function saveMeeting(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    const normalizedUrl = url.trim();

    if ((provider && !normalizedUrl) || (!provider && normalizedUrl)) {
      setError(
        "Select a meeting platform and provide its link, or clear both.",
      );
      return;
    }

    if (normalizedUrl && !validMeetingUrl(normalizedUrl)) {
      setError("Enter a valid HTTP or HTTPS meeting URL.");
      return;
    }

    setSaving(true);

    try {
      await request(`/sessions/${session.id}/meeting`, {
        method: "PATCH",
        body: JSON.stringify({
          meetingProvider: provider || null,
          meetingUrl: normalizedUrl || null,
        }),
      });

      setMessage("Meeting details saved.");
      onSaved(session.id, provider || null, normalizedUrl || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="instructor-meeting-form" onSubmit={saveMeeting}>
      <h4>Online meeting</h4>

      <label>
        Meeting platform
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          disabled={saving}
        >
          <option value="">Not configured</option>
          {MEETING_PROVIDERS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Meeting URL
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://..."
          maxLength={2048}
          disabled={saving}
        />
      </label>

      {error && (
        <p className="instructor-alert" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}

      <div className="instructor-meeting-actions">
        <button
          type="submit"
          className="instructor-primary-button"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save meeting details"}
        </button>

        {url && validMeetingUrl(url) && (
          <a href={url} target="_blank" rel="noreferrer">
            Open meeting link ↗
          </a>
        )}
      </div>
    </form>
  );
}

function AttendanceEditor({ session }) {
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAttendance() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await request(`/sessions/${session.id}/attendance`);
      setAttendance(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateRecord(enrollmentId, field, value) {
    setAttendance((current) => {
      if (!current) return current;

      return {
        ...current,
        students: current.students.map((student) =>
          student.enrollmentId === enrollmentId
            ? { ...student, [field]: value }
            : student,
        ),
      };
    });
  }

  async function saveAttendance(event) {
    event.preventDefault();
    if (!attendance) return;

    if (attendance.students.some((student) => !student.status)) {
      setError("Choose an attendance status for every student before saving.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const records = attendance.students.map((student) => ({
        enrollmentId: student.enrollmentId,
        status: student.status,
        note: student.note?.trim() || null,
      }));

      await request(`/sessions/${session.id}/attendance`, {
        method: "PUT",
        body: JSON.stringify({ records }),
      });

      await loadAttendance();
      setMessage("Attendance saved successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="instructor-attendance">
      <div className="instructor-attendance-heading">
        <h4>Student attendance</h4>
        <button
          type="button"
          className="instructor-secondary-button"
          onClick={loadAttendance}
          disabled={loading || saving}
        >
          {loading
            ? "Loading…"
            : attendance
              ? "Refresh attendance"
              : "Manage attendance"}
        </button>
      </div>

      {error && (
        <div className="instructor-alert" role="alert">
          {error}
        </div>
      )}
      {message && <p role="status">{message}</p>}

      {attendance && (
        <form onSubmit={saveAttendance}>
          {!attendance.students?.length ? (
            <p>No confirmed students are registered for this lesson.</p>
          ) : (
            <>
              <div className="instructor-table-wrap">
                <table className="instructor-table">
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>ATTENDANCE</th>
                      <th>NOTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.students.map((student) => (
                      <tr key={student.enrollmentId}>
                        <td>
                          <strong>{student.fullName || "Student"}</strong>
                          <span>{student.email || student.phone || "—"}</span>
                        </td>
                        <td>
                          <select
                            value={student.status || ""}
                            onChange={(event) =>
                              updateRecord(
                                student.enrollmentId,
                                "status",
                                event.target.value,
                              )
                            }
                            disabled={saving}
                            required
                            aria-label={`Attendance for ${student.fullName || "student"}`}
                          >
                            <option value="">Choose status</option>
                            {ATTENDANCE_STATUSES.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={student.note || ""}
                            maxLength={500}
                            placeholder="Optional note"
                            onChange={(event) =>
                              updateRecord(
                                student.enrollmentId,
                                "note",
                                event.target.value,
                              )
                            }
                            disabled={saving}
                            aria-label={`Attendance note for ${student.fullName || "student"}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                type="submit"
                className="instructor-primary-button"
                disabled={saving || loading}
              >
                {saving ? "Saving attendance…" : "Save attendance"}
              </button>
            </>
          )}
        </form>
      )}
    </section>
  );
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

  function updateMeeting(sessionId, meetingProvider, meetingUrl) {
    setSelected((current) => {
      if (!current) return current;

      return {
        ...current,
        scheduledLessons: current.scheduledLessons.map((session) =>
          session.id === sessionId
            ? { ...session, meetingProvider, meetingUrl }
            : session,
        ),
      };
    });
  }

  return (
    <section className="instructor-cohorts">
      <header className="instructor-programs-header">
        <div>
          <p className="instructor-eyebrow">TEACHING MANAGEMENT</p>
          <h1>{selected ? selected.name : "My cohorts"}</h1>
          <p className="instructor-programs-intro">
            Manage your assigned classes, online meeting links and student
            attendance.
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
                  Lessons will appear here once they are scheduled for this
                  cohort.
                </p>
              </div>
            ) : (
              <div className="instructor-sessions-list">
                {selected.scheduledLessons.map((session) => (
                  <article className="instructor-session-card" key={session.id}>
                    <div className="instructor-session-summary">
                      <div>
                        <p className="instructor-eyebrow">
                          {formatDate(session.scheduledAt, true)}
                        </p>
                        <h3>{session.lesson?.title || "Lesson"}</h3>
                        <p>
                          {session.lesson?.module?.title ||
                            "No module specified"}
                        </p>
                        <p>{session.lesson?.description || "No description"}</p>
                        <p>
                          Ends: {formatDate(session.scheduledEndAt, true)}
                          {" · "}
                          {label(session.status)}
                        </p>
                      </div>
                    </div>

                    {session.instructorNotes && (
                      <div className="instructor-cohort-notes">
                        <h4>Instructor notes</h4>
                        <p className="instructor-preserved-content">
                          {session.instructorNotes}
                        </p>
                      </div>
                    )}

                    <MeetingEditor session={session} onSaved={updateMeeting} />
                    <AttendanceEditor session={session} />
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
