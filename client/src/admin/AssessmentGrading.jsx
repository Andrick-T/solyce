import { useCallback, useEffect, useState } from "react";

const API = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

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

  if (!response.ok) {
    throw new Error(
      result?.error?.message || `Request failed (${response.status}).`,
    );
  }

  return result;
}

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Douala",
      }).format(new Date(value))
    : "—";

export default function AssessmentGrading() {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [questionScores, setQuestionScores] = useState({});
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchQueue = useCallback(async () => {
    try {
      const result = await request("/admin/assessment-grading/queue");
      setQueue(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(() => {
    setLoading(true);
    setError("");
    return fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchQueue();
    }, 0);

    return () => clearTimeout(timer);
  }, [fetchQueue]);

  async function openAttempt(id) {
    setError("");
    setNotice("");

    try {
      const result = await request(`/admin/assessment-grading/attempts/${id}`);

      const attempt = result.data;
      setSelected(attempt);
      setFeedback(attempt.feedback || "");

      const initialScores = {};

      for (const question of attempt.assessment.questions) {
        initialScores[question.id] = "";
      }

      setQuestionScores(initialScores);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateScore(questionId, value) {
    setQuestionScores((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  async function submitGrade(event) {
    event.preventDefault();

    if (!selected) return;

    const questions = selected.assessment.questions;

    const scores = questions.map((question) => ({
      questionId: question.id,
      pointsAwarded: Number(questionScores[question.id]),
    }));

    if (
      scores.some(
        (item) =>
          questionScores[item.questionId] === "" ||
          !Number.isFinite(item.pointsAwarded),
      )
    ) {
      setError("Attribuez une note à chaque question avant de publier.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await request(`/admin/assessment-grading/attempts/${selected.id}/grade`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({
          questionScores: scores,
          feedback: feedback.trim() || null,
        }),
      });

      setNotice("Résultat corrigé et publié.");
      setSelected(null);
      await loadQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">SOLYCE / LEARNING</p>
          <h1>Assessment grading</h1>
          <p>
            Review submitted work, grade each question and publish feedback for
            learners.
          </p>
        </div>

        <div className="admin-heading-actions">
          <button
            className="admin-button subtle"
            onClick={loadQueue}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

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

      {selected ? (
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">SUBMITTED WORK</p>
              <h2>{selected.assessment.title}</h2>
              <p>
                {selected.student.fullName} · {selected.cohort.name} · Submitted{" "}
                {formatDate(selected.submittedAt)}
              </p>
            </div>

            <button
              className="admin-button subtle"
              onClick={() => setSelected(null)}
              disabled={saving}
            >
              ← Back to queue
            </button>
          </div>

          <form className="admin-form-grid" onSubmit={submitGrade}>
            {selected.assessment.questions.map((question, index) => {
              const answer = selected.answers?.[String(question.id)];

              return (
                <div className="admin-panel wide" key={question.id}>
                  <div className="admin-panel-heading">
                    <div>
                      <p className="admin-eyebrow">
                        QUESTION {index + 1} ·{" "}
                        {question.questionType.replaceAll("_", " ")}
                      </p>
                      <h2>{question.prompt}</h2>
                    </div>

                    <span className="admin-status draft">
                      Max. {question.points} points
                    </span>
                  </div>

                  <div style={{ padding: "18px 22px" }}>
                    <p className="admin-eyebrow">STUDENT ANSWER</p>

                    <div
                      style={{
                        padding: 14,
                        background: "#f5f6f0",
                        borderRadius: 6,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        lineHeight: 1.7,
                      }}
                    >
                      {answer === undefined || answer === null
                        ? "No answer provided."
                        : Array.isArray(answer)
                          ? answer.join(", ")
                          : String(answer)}
                    </div>

                    {question.options && (
                      <details style={{ marginTop: 14 }}>
                        <summary>Review answer options</summary>
                        <pre
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {JSON.stringify(question.options, null, 2)}
                        </pre>
                      </details>
                    )}

                    {question.correctAnswer !== null &&
                      question.correctAnswer !== undefined && (
                        <details style={{ marginTop: 10 }}>
                          <summary>View expected answer</summary>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {JSON.stringify(question.correctAnswer, null, 2)}
                          </pre>
                        </details>
                      )}

                    {question.explanation && (
                      <details style={{ marginTop: 10 }}>
                        <summary>View explanation</summary>
                        <p>{question.explanation}</p>
                      </details>
                    )}

                    <label
                      className="admin-field"
                      style={{ marginTop: 20, maxWidth: 240 }}
                    >
                      <span>Points awarded</span>
                      <input
                        type="number"
                        min="0"
                        max={question.points}
                        step="0.25"
                        required
                        value={questionScores[question.id]}
                        onChange={(event) =>
                          updateScore(question.id, event.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            <label className="admin-field wide">
              <span>Feedback for the student</span>
              <textarea
                rows={5}
                maxLength={10000}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Summarise strengths, areas to improve and recommended next steps…"
              />
            </label>

            <div className="admin-alert wide">
              Publishing the grade makes the result available to the student.
              Review all question scores before continuing.
            </div>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-button subtle"
                onClick={() => setSelected(null)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="admin-button primary"
                disabled={saving}
              >
                {saving ? "Publishing…" : "Publish result"}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="admin-panel admin-table-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-eyebrow">INSTRUCTOR WORKFLOW</p>
              <h2>
                Awaiting correction{" "}
                <span className="count-pill">{queue.length}</span>
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="admin-empty">Loading submitted work…</div>
          ) : queue.length === 0 ? (
            <div className="admin-empty">
              No submitted assessments are waiting for correction.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Assessment</th>
                    <th>Program / lesson</th>
                    <th>Cohort</th>
                    <th>Submitted</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="table-primary">
                          {item.student.fullName}
                        </div>
                        <div className="table-secondary">
                          {item.student.email || "Guest student"}
                        </div>
                      </td>
                      <td>
                        <div className="table-primary">
                          {item.assessment.title}
                        </div>
                        <div className="table-secondary">
                          Attempt {item.attemptNumber}
                        </div>
                      </td>
                      <td>
                        <div className="table-primary">
                          {item.assessment.course}
                        </div>
                        <div className="table-secondary">
                          {item.assessment.lesson}
                        </div>
                      </td>
                      <td>{item.cohort.name}</td>
                      <td>{formatDate(item.submittedAt)}</td>
                      <td>
                        <button
                          className="admin-button small subtle"
                          onClick={() => openAttempt(item.id)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
