import { useCallback, useEffect, useMemo, useState } from "react";
import "./Assessments.css";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}/api/instructor/assessments${path}`, {
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
      body?.error?.message || "Something went wrong. Please try again.",
    );
  }

  return body?.data;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function formatScore(value) {
  if (value === null || value === undefined) return "—";

  const score = Number(value);
  return Number.isFinite(score) ? score.toLocaleString("en") : "—";
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "No answer provided";
  }

  if (Array.isArray(value)) {
    return value.map(displayValue).join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${displayValue(item)}`)
      .join("\n");
  }

  return String(value);
}

function statusLabel(status) {
  return (
    {
      SUBMITTED: "Awaiting grading",
      GRADED: "Graded",
      IN_PROGRESS: "In progress",
    }[status] || status
  );
}

export default function InstructorAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [questionScores, setQuestionScores] = useState({});
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await api("");
      setAssessments(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssessments();
  }, [loadAssessments]);

  const loadAttempts = useCallback(async (assessment) => {
    setLoadingAttempts(true);
    setError("");
    setNotice("");
    setSelectedAssessment(assessment);
    setSelectedAttempt(null);
    setAttempts([]);

    try {
      const result = await api(`/${assessment.id}/attempts`);
      setAttempts(result?.attempts || []);
      setSelectedAssessment(result?.assessment || assessment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAttempts(false);
    }
  }, []);

  async function openAttempt(attempt) {
    setLoadingAttempt(true);
    setError("");
    setSelectedAttempt(null);
    setQuestionScores({});
    setFeedback("");

    try {
      const result = await api(`/attempts/${attempt.id}`);
      setSelectedAttempt(result);

      const initialScores = {};

      for (const question of result.assessment?.questions || []) {
        initialScores[question.id] = "";
      }

      setQuestionScores(initialScores);
      setFeedback(result.feedback || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAttempt(false);
    }
  }

  const questions = selectedAttempt?.assessment?.questions || [];

  const maxQuestionScore = useMemo(
    () =>
      questions.reduce(
        (sum, question) => sum + Number(question.points || 0),
        0,
      ),
    [questions],
  );

  const assessmentMaxScore =
    Number(selectedAttempt?.assessment?.maxScore) || maxQuestionScore;

  const enteredScore = questions.reduce((sum, question) => {
    const value = questionScores[question.id];

    if (value === "" || value === undefined) return sum;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? sum + numericValue : sum;
  }, 0);

  const allQuestionsScored = questions.every((question) => {
    const value = questionScores[question.id];

    return (
      value !== "" &&
      value !== undefined &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number(value) <= Number(question.points)
    );
  });

  async function submitGrade(event) {
    event.preventDefault();

    if (!selectedAttempt || selectedAttempt.status !== "SUBMITTED") return;

    if (!allQuestionsScored) {
      setError("Enter a valid score for every question before submitting.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        questionScores: questions.map((question) => ({
          questionId: question.id,
          pointsAwarded: Number(questionScores[question.id]),
        })),
        score: enteredScore,
        feedback: feedback.trim() || null,
      };

      await api(`/attempts/${selectedAttempt.id}/grade`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setNotice("The assessment has been graded successfully.");

      await loadAssessments();

      if (selectedAssessment) {
        await loadAttempts(selectedAssessment);
      }

      // Refresh the selected attempt so its final status and score are current.
      const refreshed = await api(`/attempts/${selectedAttempt.id}`);
      setSelectedAttempt(refreshed);
      setFeedback(refreshed.feedback || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateQuestionScore(questionId, value) {
    setQuestionScores((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function backToAttempts() {
    setSelectedAttempt(null);
    setError("");
    setNotice("");
  }

  function backToAssessments() {
    setSelectedAssessment(null);
    setSelectedAttempt(null);
    setAttempts([]);
    setError("");
    setNotice("");
  }

  const visibleAssessments = assessments.filter((assessment) => {
    if (filter === "pending") return assessment.attempts?.submitted > 0;
    if (filter === "graded") return assessment.attempts?.graded > 0;
    return true;
  });

  if (loading) {
    return (
      <section className="assessments-page">
        <div className="assessments-loading">Loading your assessments…</div>
      </section>
    );
  }

  return (
    <section className="assessments-page">
      <div className="assessments-heading">
        <div>
          <p className="instructor-eyebrow">STUDENT PROGRESS</p>
          <h1>Assessments</h1>
          <p className="assessments-subtitle">
            Review submissions, assess student understanding and provide
            meaningful feedback.
          </p>
        </div>

        <button
          type="button"
          className="instructor-secondary-button"
          onClick={loadAssessments}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="assessments-alert error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="assessments-alert success" role="status">
          {notice}
        </div>
      )}

      {!selectedAssessment ? (
        <>
          <div className="assessments-summary">
            <article>
              <span>ASSESSMENTS</span>
              <strong>{assessments.length}</strong>
              <p>Assigned to your programs</p>
            </article>
            <article>
              <span>AWAITING GRADING</span>
              <strong>
                {assessments.reduce(
                  (sum, item) => sum + (item.attempts?.submitted || 0),
                  0,
                )}
              </strong>
              <p>Submissions requiring review</p>
            </article>
            <article>
              <span>GRADED ATTEMPTS</span>
              <strong>
                {assessments.reduce(
                  (sum, item) => sum + (item.attempts?.graded || 0),
                  0,
                )}
              </strong>
              <p>Completed corrections</p>
            </article>
          </div>

          <div className="assessments-list-toolbar">
            <div>
              <h2>Your assessments</h2>
              <p>Select an assessment to review student submissions.</p>
            </div>

            <select
              aria-label="Filter assessments"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All assessments</option>
              <option value="pending">Awaiting grading</option>
              <option value="graded">Has graded attempts</option>
            </select>
          </div>

          {visibleAssessments.length === 0 ? (
            <div className="assessments-empty">
              <span className="assessments-empty-icon">✓</span>
              <h3>
                {assessments.length === 0
                  ? "No assessments assigned yet"
                  : "No assessments match this filter"}
              </h3>
              <p>
                {assessments.length === 0
                  ? "Assessments associated with your assigned programs will appear here."
                  : "Try another filter to see your assessments."}
              </p>
            </div>
          ) : (
            <div className="assessments-grid">
              {visibleAssessments.map((assessment) => (
                <article className="assessment-card" key={assessment.id}>
                  <div className="assessment-card-top">
                    <span className="assessment-type">
                      {String(
                        assessment.assessmentType || "ASSESSMENT",
                      ).replaceAll("_", " ")}
                    </span>
                    <span className="assessment-points">
                      {assessment.maxScore ?? "—"} pts
                    </span>
                  </div>

                  <h3>{assessment.title}</h3>

                  <p className="assessment-course">
                    {assessment.lesson?.module?.course?.title || "Program"}
                  </p>

                  <p className="assessment-lesson">
                    {assessment.lesson?.module?.title || "Module"} ·{" "}
                    {assessment.lesson?.title || "Lesson"}
                  </p>

                  <div className="assessment-card-stats">
                    <div>
                      <strong>{assessment.attempts?.submitted || 0}</strong>
                      <span>To grade</span>
                    </div>
                    <div>
                      <strong>{assessment.attempts?.graded || 0}</strong>
                      <span>Graded</span>
                    </div>
                    <div>
                      <strong>{assessment.attempts?.inProgress || 0}</strong>
                      <span>In progress</span>
                    </div>
                  </div>

                  {assessment.dueAt && (
                    <p className="assessment-due">
                      Due {formatDate(assessment.dueAt)}
                    </p>
                  )}

                  <button
                    type="button"
                    className="instructor-primary-button assessment-open-button"
                    onClick={() => loadAttempts(assessment)}
                  >
                    Review submissions <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      ) : !selectedAttempt ? (
        <div className="assessments-detail-view">
          <button
            type="button"
            className="assessments-back-button"
            onClick={backToAssessments}
          >
            ← All assessments
          </button>

          <div className="assessments-detail-heading">
            <div>
              <p className="instructor-eyebrow">SUBMISSIONS</p>
              <h2>{selectedAssessment.title}</h2>
              <p>
                {selectedAssessment.lesson?.module?.course?.title ||
                  "Assigned program"}
              </p>
            </div>
            <span className="assessment-points">
              {selectedAssessment.maxScore ?? "—"} pts
            </span>
          </div>

          {loadingAttempts ? (
            <div className="assessments-loading">Loading submissions…</div>
          ) : attempts.length === 0 ? (
            <div className="assessments-empty">
              <h3>No submitted attempts</h3>
              <p>
                Submitted and graded attempts will appear here when students
                complete this assessment.
              </p>
            </div>
          ) : (
            <div className="assessments-table-wrap">
              <table className="assessments-table">
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>COHORT</th>
                    <th>SUBMITTED</th>
                    <th>SCORE</th>
                    <th>STATUS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>
                        <strong>
                          {attempt.student?.fullName || "Student"}
                        </strong>
                        <span>{attempt.student?.email || "No email"}</span>
                      </td>
                      <td>{attempt.cohort?.name || "—"}</td>
                      <td>{formatDate(attempt.submittedAt)}</td>
                      <td>
                        {attempt.status === "GRADED"
                          ? formatScore(attempt.score)
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`assessment-status status-${attempt.status.toLowerCase()}`}
                        >
                          {statusLabel(attempt.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="assessments-row-action"
                          onClick={() => openAttempt(attempt)}
                        >
                          {attempt.status === "GRADED" ? "View" : "Grade"} →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="assessments-detail-view">
          <button
            type="button"
            className="assessments-back-button"
            onClick={backToAttempts}
          >
            ← Back to submissions
          </button>

          {loadingAttempt ? (
            <div className="assessments-loading">Loading student attempt…</div>
          ) : (
            <>
              <div className="assessments-detail-heading">
                <div>
                  <p className="instructor-eyebrow">STUDENT SUBMISSION</p>
                  <h2>{selectedAttempt.student?.fullName || "Student"}</h2>
                  <p>
                    {selectedAttempt.student?.email || "No email"} ·{" "}
                    {selectedAttempt.cohort?.name || "Assigned cohort"}
                  </p>
                </div>

                <span
                  className={`assessment-status status-${selectedAttempt.status.toLowerCase()}`}
                >
                  {statusLabel(selectedAttempt.status)}
                </span>
              </div>

              <div className="assessments-attempt-meta">
                <div>
                  <span>ASSESSMENT</span>
                  <strong>{selectedAttempt.assessment.title}</strong>
                </div>
                <div>
                  <span>SUBMITTED</span>
                  <strong>{formatDate(selectedAttempt.submittedAt)}</strong>
                </div>
                <div>
                  <span>MAXIMUM SCORE</span>
                  <strong>{assessmentMaxScore} points</strong>
                </div>
                {selectedAttempt.status === "GRADED" && (
                  <div>
                    <span>FINAL SCORE</span>
                    <strong>
                      {formatScore(selectedAttempt.score)} /{" "}
                      {assessmentMaxScore}
                    </strong>
                  </div>
                )}
              </div>

              {selectedAttempt.status === "GRADED" && (
                <div className="assessments-readonly-notice">
                  This attempt has already been graded. The current version
                  allows you to review the correction but not modify it.
                </div>
              )}

              <form className="assessments-grading-form" onSubmit={submitGrade}>
                <div className="assessments-question-heading">
                  <div>
                    <h3>Questions and answers</h3>
                    <p>
                      Award points for each question. The final score is
                      calculated automatically.
                    </p>
                  </div>
                  <div className="assessments-total-score">
                    <span>RUNNING TOTAL</span>
                    <strong>
                      {formatScore(enteredScore)} / {assessmentMaxScore}
                    </strong>
                  </div>
                </div>

                {questions.length === 0 ? (
                  <div className="assessments-empty">
                    <h3>No questions found</h3>
                    <p>This assessment does not contain any questions.</p>
                  </div>
                ) : (
                  questions.map((question, index) => {
                    const answer = selectedAttempt.answers;
                    const studentAnswer =
                      answer && typeof answer === "object"
                        ? (answer[question.id] ??
                          answer[String(question.id)] ??
                          answer[question.id.toString()])
                        : undefined;

                    const isReadOnly = selectedAttempt.status !== "SUBMITTED";

                    return (
                      <article
                        className="assessments-question-card"
                        key={question.id}
                      >
                        <div className="assessments-question-top">
                          <span>QUESTION {index + 1}</span>
                          <span>{question.points} points maximum</span>
                        </div>

                        <h4>{question.prompt}</h4>

                        {Array.isArray(question.options) &&
                          question.options.length > 0 && (
                            <div className="assessments-options">
                              <span>Available options</span>
                              <ul>
                                {question.options.map((option, optionIndex) => (
                                  <li key={optionIndex}>
                                    {displayValue(option)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        <div className="assessments-answer-block">
                          <span>STUDENT ANSWER</span>
                          <p>{displayValue(studentAnswer)}</p>
                        </div>

                        {question.correctAnswer !== undefined && (
                          <div className="assessments-correct-answer">
                            <span>EXPECTED ANSWER</span>
                            <p>{displayValue(question.correctAnswer)}</p>
                          </div>
                        )}

                        {question.explanation && (
                          <div className="assessments-explanation">
                            <strong>Explanation</strong>
                            <p>{question.explanation}</p>
                          </div>
                        )}

                        <label className="assessments-score-field">
                          <span>Points awarded</span>
                          <div>
                            <input
                              type="number"
                              min="0"
                              max={question.points}
                              step="0.5"
                              value={
                                isReadOnly
                                  ? Number(questionScores[question.id] || 0)
                                  : questionScores[question.id]
                              }
                              disabled={isReadOnly}
                              required={!isReadOnly}
                              onChange={(event) =>
                                updateQuestionScore(
                                  question.id,
                                  event.target.value,
                                )
                              }
                            />
                            <span>/ {question.points}</span>
                          </div>
                        </label>
                      </article>
                    );
                  })
                )}

                <div className="assessments-feedback-panel">
                  <label htmlFor="assessment-feedback">
                    Feedback for the student
                    <span>
                      Explain what went well and what the student should
                      improve.
                    </span>
                  </label>
                  <textarea
                    id="assessment-feedback"
                    rows="4"
                    maxLength="10000"
                    value={feedback}
                    disabled={selectedAttempt.status !== "SUBMITTED"}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="Write constructive feedback…"
                  />
                </div>

                {selectedAttempt.status === "SUBMITTED" && (
                  <div className="assessments-submit-row">
                    <p>
                      {allQuestionsScored
                        ? "All questions have a valid score."
                        : "Score every question to submit the correction."}
                    </p>
                    <button
                      type="submit"
                      className="instructor-primary-button"
                      disabled={
                        saving || questions.length === 0 || !allQuestionsScored
                      }
                    >
                      {saving ? "Saving grade…" : "Submit final grade"}
                      <span>→</span>
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
