import { useCallback, useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      body?.error?.message || "Unable to complete this action.",
    );

    error.code = body?.error?.code;
    error.status = response.status;
    throw error;
  }

  return body?.data;
}

function formatDate(value) {
  if (!value) return "Not specified";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not specified"
    : new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function getAttemptDeadline(attempt, assessment) {
  const minutes = Number(assessment?.timeLimitMinutes);
  const startedAt = new Date(attempt?.startedAt).getTime();

  if (
    !Number.isFinite(minutes) ||
    minutes <= 0 ||
    !Number.isFinite(startedAt)
  ) {
    return null;
  }

  return startedAt + minutes * 60_000;
}

function formatRemainingTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\\w/, (character) => character.toUpperCase());
}

function optionsFor(question) {
  if (!Array.isArray(question.options)) return [];

  return question.options.map((option) => {
    if (typeof option === "string") {
      return { label: option, value: option };
    }

    return {
      label: String(option.label ?? option.text ?? option.value ?? ""),
      value: option.value ?? option.label ?? option.text ?? "",
    };
  });
}

function QuestionInput({ question, value, onChange, disabled }) {
  const options = optionsFor(question);

  if (
    question.questionType === "SINGLE_CHOICE" ||
    question.questionType === "TRUE_FALSE"
  ) {
    const choices =
      question.questionType === "TRUE_FALSE" && options.length === 0
        ? [
            { label: "True", value: "true" },
            { label: "False", value: "false" },
          ]
        : options;

    return (
      <div className="student-assessment-options">
        {choices.map((option, index) => (
          <label key={`${question.id}-${index}`}>
            <input
              type="radio"
              name={`question-${question.id}`}
              value={String(option.value)}
              checked={String(value ?? "") === String(option.value)}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === "MULTIPLE_CHOICE") {
    const selected = Array.isArray(value) ? value.map(String) : [];

    return (
      <div className="student-assessment-options">
        {options.map((option, index) => {
          const optionValue = String(option.value);
          const checked = selected.includes(optionValue);

          return (
            <label key={`${question.id}-${index}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  onChange(
                    checked
                      ? selected.filter((item) => item !== optionValue)
                      : [...selected, optionValue],
                  );
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (question.questionType === "LONG_ANSWER") {
    return (
      <textarea
        rows={6}
        maxLength={10000}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer here…"
      />
    );
  }

  return (
    <input
      type="text"
      maxLength={10000}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Enter your answer…"
    />
  );
}

export default function StudentAssessments() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clockNow, setClockNow] = useState(0);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    if (!active) return undefined;

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [active?.attempt?.id, active?.attempt?.startedAt]);

  const loadLearning = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [learningData, attemptData] = await Promise.all([
        request("/api/student/learning"),
        request("/api/student/assessments/attempts"),
      ]);

      setSessions(Array.isArray(learningData) ? learningData : []);
      setAttempts(Array.isArray(attemptData) ? attemptData : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLearning();
  }, [loadLearning]);

  const assessments = sessions.flatMap((session) =>
    (session.assessments || []).map((assessment) => ({
      ...assessment,
      sessionId: session.id,
      sessionTitle: session.lesson?.title || "Learning session",
      scheduledAt: session.scheduledAt,
      accessPhase: session.accessPhase,
      courseTitle: session.cohort?.course?.title || "Solyce course",
      cohortName: session.cohort?.name || "Cohort",
    })),
  );
  const latestAttempts = new Map();

  for (const attempt of attempts) {
    const current = latestAttempts.get(attempt.assessmentId);

    if (!current || attempt.attemptNumber > current.attemptNumber) {
      latestAttempts.set(attempt.assessmentId, attempt);
    }
  }

  async function startAssessment(assessment) {
    setBusy(true);
    setError("");
    setNotice("");
    setResult(null);

    try {
      const response = await request(
        `/api/student/assessments/assessments/${assessment.id}/attempts`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      const attempt = response?.attempt;

      if (!attempt) {
        throw new Error("The server did not return an attempt.");
      }

      setActive({
        assessment,
        attempt,
        questions: response.questions || [],
      });

      setAnswers(
        attempt.answers &&
          typeof attempt.answers === "object" &&
          !Array.isArray(attempt.answers)
          ? attempt.answers
          : {},
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function updateAnswer(questionId, value) {
    setAnswers((current) => ({
      ...current,
      [String(questionId)]: value,
    }));
  }

  async function saveAnswers() {
    if (!active) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await request(
        `/api/student/assessments/attempts/${active.attempt.id}/answers`,
        {
          method: "PATCH",
          body: JSON.stringify({ answers }),
        },
      );

      if (response?.attempt) {
        setActive((current) =>
          current
            ? {
                ...current,
                attempt: response.attempt,
              }
            : current,
        );
      }

      setNotice("Your answers have been saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function viewResult(attemptId) {
    const response = await request(
      `/api/student/assessments/attempts/${attemptId}`,
    );

    setResult(response);
  }

  async function submitAssessment() {
    if (!active || busy) return;

    const confirmed = window.confirm(
      "Submit this assessment? You will not be able to change your answers afterwards.",
    );

    if (!confirmed) return;

    const attemptId = active.attempt.id;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      // Save the latest answers when the attempt is still within its time limit.
      // Once the server confirms expiry, submit the answers already saved.
      try {
        await request(
          `/api/student/assessments/attempts/${attemptId}/answers`,
          {
            method: "PATCH",
            body: JSON.stringify({ answers }),
          },
        );
      } catch (saveError) {
        if (saveError.code !== "ATTEMPT_TIME_EXPIRED") {
          throw saveError;
        }
      }

      const response = await request(
        `/api/student/assessments/attempts/${attemptId}/submit`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      if (!response?.attempt?.id) {
        throw new Error("The server did not confirm the submission.");
      }

      setActive(null);
      setAnswers({});

      setNotice(
        response.grading?.automaticallyGraded
          ? "Your assessment has been submitted and graded automatically."
          : "Your assessment has been submitted for correction.",
      );

      try {
        await viewResult(response.attempt.id);
      } catch (resultError) {
        // Submission succeeded even if fetching the result fails.
        setError(
          `Your assessment was submitted, but its result could not be loaded: ${resultError.message}`,
        );
      }

      await loadLearning();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="student-panel student-subpage-panel">
        <p>Loading your assessments…</p>
      </div>
    );
  }

  if (active) {
    const isOpen = active.attempt.status === "IN_PROGRESS";
    const deadline = getAttemptDeadline(active.attempt, active.assessment);
    const isExpired = deadline !== null && clockNow >= deadline;
    const canEdit = isOpen && !isExpired && !busy;

    return (
      <section className="student-assessment-page">
        <div className="student-panel student-subpage-panel">
          <button
            type="button"
            className="student-text-button"
            disabled={busy}
            onClick={() => {
              setActive(null);
              setError("");
              setNotice("");
            }}
          >
            ← Back to assessments
          </button>

          <p className="student-eyebrow">
            {label(active.assessment.assessmentType)}
          </p>

          <h2>{active.assessment.title}</h2>

          {active.assessment.instructions && (
            <p>{active.assessment.instructions}</p>
          )}

          {active.assessment.description && (
            <p>{active.assessment.description}</p>
          )}

          <p>
            Attempt {active.attempt.attemptNumber} ·{" "}
            {label(active.attempt.status)}
          </p>

          {deadline !== null && isOpen && (
            <div
              className={`student-assessment-timer${isExpired ? " is-expired" : ""}`}
              role="timer"
              aria-live="off"
            >
              <span>{isExpired ? "Time expired" : "Time remaining"}</span>
              <strong>{formatRemainingTime(deadline - clockNow)}</strong>

              {isExpired && (
                <p>
                  Your answers can no longer be changed. Submit your saved
                  answers to finish this attempt.
                </p>
              )}
            </div>
          )}

          {active.questions.map((question, index) => (
            <article className="student-assessment-question" key={question.id}>
              <h3>
                {index + 1}. {question.prompt}
              </h3>

              <p>{question.points} point(s)</p>

              <QuestionInput
                question={question}
                value={answers[String(question.id)]}
                disabled={!canEdit}
                onChange={(value) => updateAnswer(question.id, value)}
              />
            </article>
          ))}

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

          {isOpen ? (
            <div className="student-assessment-actions">
              <button
                type="button"
                className="student-text-button"
                disabled={busy || isExpired}
                onClick={saveAnswers}
              >
                {busy ? "Saving…" : "Save answers"}
              </button>

              <button
                type="button"
                className="student-primary-button"
                disabled={busy}
                onClick={submitAssessment}
              >
                {busy ? "Submitting…" : "Submit assessment →"}
              </button>
            </div>
          ) : (
            <p>This attempt has been submitted and can no longer be edited.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="student-assessment-page">
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

      {result && (
        <div className="student-panel student-subpage-panel">
          <button
            type="button"
            className="student-text-button"
            onClick={() => setResult(null)}
          >
            ← Close result
          </button>

          <p className="student-eyebrow">ASSESSMENT RESULT</p>

          <h2>{result.assessment?.title || "Assessment result"}</h2>

          <p>Status: {label(result.attempt?.status)}</p>

          {result.attempt?.status === "GRADED" ? (
            <>
              <p>
                Score: {result.attempt.score ?? "—"}
                {result.assessment?.maxScore != null
                  ? ` / ${result.assessment.maxScore}`
                  : ""}
              </p>

              {result.attempt.feedback && (
                <div>
                  <h3>Instructor feedback</h3>
                  <p>{result.attempt.feedback}</p>
                </div>
              )}

              {Array.isArray(result.explanations) &&
                result.explanations.some((item) => item.explanation) && (
                  <div>
                    <h3>Answer explanations</h3>

                    {result.explanations
                      .filter((item) => item.explanation)
                      .map((item) => (
                        <p key={item.questionId}>{item.explanation}</p>
                      ))}
                  </div>
                )}
            </>
          ) : (
            <p>
              Your work has been submitted. The final score and feedback will
              appear here when correction is complete.
            </p>
          )}
        </div>
      )}

      <div className="student-panel student-subpage-panel">
        <div className="student-panel-heading">
          <div>
            <p className="student-eyebrow">PRACTICE & FEEDBACK</p>
            <h2>Your assessments</h2>
          </div>

          <button
            type="button"
            className="student-inline-link"
            disabled={loading || busy}
            onClick={loadLearning}
          >
            Refresh ↻
          </button>
        </div>

        {assessments.length === 0 ? (
          <div className="student-empty">
            <div className="student-empty-icon">✓</div>
            <h3>No assessments available yet</h3>
            <p>
              Published assessments will appear here when they are released for
              your enrolled cohort.
            </p>
          </div>
        ) : (
          assessments.map((assessment) => {
            const latestAttempt = latestAttempts.get(assessment.id);
            const isInProgress = latestAttempt?.status === "IN_PROGRESS";
            const isGraded = latestAttempt?.status === "GRADED";

            return (
              <article
                className="student-record"
                key={`${assessment.sessionId}-${assessment.id}`}
              >
                <div>
                  <strong>{assessment.title}</strong>

                  <span>
                    {assessment.courseTitle} · {assessment.cohortName}
                  </span>

                  <small>
                    {label(assessment.assessmentType)} ·{" "}
                    {label(assessment.releasePhase)} ·{" "}
                    {assessment.dueAt
                      ? `Due ${formatDate(assessment.dueAt)}`
                      : "No deadline specified"}
                  </small>

                  {assessment.timeLimitMinutes > 0 && (
                    <small>
                      Time limit: {assessment.timeLimitMinutes} minutes
                    </small>
                  )}

                  {latestAttempt && (
                    <small>
                      Latest attempt #{latestAttempt.attemptNumber}:{" "}
                      {label(latestAttempt.status)}
                      {latestAttempt.submittedAt
                        ? ` · Submitted ${formatDate(latestAttempt.submittedAt)}`
                        : ""}
                      {isGraded && latestAttempt.score != null
                        ? ` · Score ${latestAttempt.score}${
                            latestAttempt.assessment?.maxScore != null
                              ? ` / ${latestAttempt.assessment.maxScore}`
                              : ""
                          }`
                        : ""}
                    </small>
                  )}
                </div>

                <div className="student-assessment-list-actions">
                  {latestAttempt && !isInProgress && (
                    <button
                      type="button"
                      className="student-text-button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError("");

                        try {
                          await viewResult(latestAttempt.id);
                        } catch (err) {
                          setError(err.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      View result
                    </button>
                  )}

                  <button
                    type="button"
                    className="student-text-button"
                    disabled={busy}
                    onClick={() => startAssessment(assessment)}
                  >
                    {isInProgress
                      ? "Resume attempt"
                      : latestAttempt
                        ? "Start another attempt"
                        : "Start assessment"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
