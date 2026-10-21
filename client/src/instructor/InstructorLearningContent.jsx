import { useCallback, useEffect, useState } from "react";

const API = "/api/instructor/learning-content";
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const emptyResource = {
  title: "",
  description: "",
  resourceType: "PDF",
  url: "",
  releasePhase: "PREPARATION",
  position: 0,
};

const emptyAssessment = {
  title: "",
  description: "",
  assessmentType: "HOMEWORK",
  releasePhase: "AFTER_SESSION",
  instructions: "",
  maxScore: "20",
  passingScore: "10",
  timeLimitMinutes: "",
  dueAt: "",
};

const emptyQuestion = {
  questionType: "SINGLE_CHOICE",
  prompt: "",
  options: "Option A\nOption B",
  correctAnswer: "",
  explanation: "",
  points: "1",
  position: "1",
};

function errorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Unable to complete this request.";
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const body =
    response.status === 204 ? {} : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error?.message || "Unable to complete this request.");
  }

  return body;
}

function nullableText(value) {
  return String(value ?? "").trim() || null;
}

function dateForInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function Field({ label, children, wide = false }) {
  return (
    <label
      className={
        wide ? "instructor-learning-field wide" : "instructor-learning-field"
      }
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

function Actions({ busy, onCancel, submitLabel }) {
  return (
    <div className="instructor-studio-actions">
      <button
        className="instructor-primary-button"
        type="submit"
        disabled={busy}
      >
        {busy ? "Saving…" : submitLabel}
      </button>
      <button
        className="instructor-secondary-button"
        type="button"
        onClick={onCancel}
        disabled={busy}
      >
        Cancel
      </button>
    </div>
  );
}

export default function InstructorLearningContent({
  lessonId,
  canEdit: parentCanEdit,
}) {
  const [lesson, setLesson] = useState(null);
  const [resources, setResources] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [assessmentForm, setAssessmentForm] = useState(emptyAssessment);
  const [questionForm, setQuestionForm] = useState(emptyQuestion);

  const [editingResourceId, setEditingResourceId] = useState(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [editingQuestionId, setEditingQuestionId] = useState(null);

  const [resourceFormOpen, setResourceFormOpen] = useState(false);
  const [assessmentFormOpen, setAssessmentFormOpen] = useState(false);
  const [questionFormOpen, setQuestionFormOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedAssessment =
    assessments.find((item) => item.id === selectedAssessmentId) ?? null;

  const canEdit = parentCanEdit && lesson?.canEdit === true;

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request(`/lessons/${lessonId}`);
      const data = result.data ?? {};
      const nextAssessments = Array.isArray(data.assessments)
        ? data.assessments
        : [];

      setLesson(data);
      setResources(Array.isArray(data.resources) ? data.resources : []);
      setAssessments(nextAssessments);
      setSelectedAssessmentId((current) =>
        nextAssessments.some((item) => item.id === current)
          ? current
          : (nextAssessments[0]?.id ?? null),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    // Avoid calling setState synchronously in effect body
    // Use microtask to defer loadContent
    const id = setTimeout(() => {
      loadContent();
    }, 0);
    return () => clearTimeout(id);
  }, [loadContent]);

  function resetResource() {
    setResourceForm(emptyResource);
    setEditingResourceId(null);
    setResourceFormOpen(false);
  }

  function editResource(resource) {
    setResourceForm({
      title: resource.title ?? "",
      description: resource.description ?? "",
      resourceType: resource.resourceType ?? "PDF",
      url: resource.url ?? "",
      releasePhase: resource.releasePhase ?? "AFTER_SESSION",
      position: resource.position ?? 0,
    });
    setEditingResourceId(resource.id);
    setResourceFormOpen(true);
    setNotice("");
  }

  async function saveResource(event) {
    event.preventDefault();
    if (!canEdit || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title: resourceForm.title.trim(),
        description: nullableText(resourceForm.description),
        resourceType: resourceForm.resourceType,
        url: resourceForm.url.trim(),
        releasePhase: resourceForm.releasePhase,
        position: Number(resourceForm.position),
      };

      if (editingResourceId !== null) {
        await request(`/resources/${editingResourceId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/resources", {
          method: "POST",
          body: JSON.stringify({ lessonId: Number(lessonId), ...payload }),
        });
      }

      await loadContent();
      resetResource();
      setNotice(
        "Resource saved. It remains unpublished until administrator review.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function resetAssessment() {
    setAssessmentForm(emptyAssessment);
    setEditingAssessmentId(null);
    setAssessmentFormOpen(false);
  }

  function editAssessment(assessment) {
    setAssessmentForm({
      title: assessment.title ?? "",
      description: assessment.description ?? "",
      assessmentType: assessment.assessmentType ?? "HOMEWORK",
      releasePhase: assessment.releasePhase ?? "AFTER_SESSION",
      instructions: assessment.instructions ?? "",
      maxScore: assessment.maxScore == null ? "" : String(assessment.maxScore),
      passingScore:
        assessment.passingScore == null ? "" : String(assessment.passingScore),
      timeLimitMinutes:
        assessment.timeLimitMinutes == null
          ? ""
          : String(assessment.timeLimitMinutes),
      dueAt: dateForInput(assessment.dueAt),
    });
    setEditingAssessmentId(assessment.id);
    setSelectedAssessmentId(assessment.id);
    setAssessmentFormOpen(true);
    setNotice("");
  }

  async function saveAssessment(event) {
    event.preventDefault();
    if (!canEdit || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title: assessmentForm.title.trim(),
        description: nullableText(assessmentForm.description),
        assessmentType: assessmentForm.assessmentType,
        releasePhase: assessmentForm.releasePhase,
        instructions: nullableText(assessmentForm.instructions),
        maxScore:
          assessmentForm.maxScore === ""
            ? null
            : Number(assessmentForm.maxScore),
        passingScore:
          assessmentForm.passingScore === ""
            ? null
            : Number(assessmentForm.passingScore),
        timeLimitMinutes:
          assessmentForm.timeLimitMinutes === ""
            ? null
            : Number(assessmentForm.timeLimitMinutes),
        dueAt: assessmentForm.dueAt
          ? new Date(assessmentForm.dueAt).toISOString()
          : null,
      };

      let saved;
      if (editingAssessmentId !== null) {
        const result = await request(`/assessments/${editingAssessmentId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        saved = result.data;
      } else {
        const result = await request("/assessments", {
          method: "POST",
          body: JSON.stringify({ lessonId: Number(lessonId), ...payload }),
        });
        saved = result.data;
      }

      await loadContent();
      if (saved?.id) setSelectedAssessmentId(saved.id);
      resetAssessment();
      setNotice(
        "Assessment saved. It remains unpublished until administrator review.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function resetQuestion() {
    setQuestionForm(emptyQuestion);
    setEditingQuestionId(null);
    setQuestionFormOpen(false);
  }

  function editQuestion(question) {
    const options = Array.isArray(question.options)
      ? question.options.join("\n")
      : "";
    let correctAnswer = question.correctAnswer;

    if (Array.isArray(correctAnswer)) {
      correctAnswer = correctAnswer.join(", ");
    } else if (typeof correctAnswer === "boolean") {
      correctAnswer = String(correctAnswer);
    } else if (correctAnswer == null) {
      correctAnswer = "";
    }

    setQuestionForm({
      questionType: question.questionType,
      prompt: question.prompt ?? "",
      options,
      correctAnswer: String(correctAnswer),
      explanation: question.explanation ?? "",
      points: String(question.points ?? 1),
      position: String(question.position ?? 1),
    });
    setEditingQuestionId(question.id);
    setQuestionFormOpen(true);
    setNotice("");
  }

  async function saveQuestion(event) {
    event.preventDefault();
    if (!canEdit || busy || !selectedAssessment) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const type = questionForm.questionType;
      const options = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(type)
        ? questionForm.options
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
        : null;

      let correctAnswer = null;
      if (type === "SINGLE_CHOICE") {
        correctAnswer = questionForm.correctAnswer.trim();
      } else if (type === "MULTIPLE_CHOICE") {
        correctAnswer = questionForm.correctAnswer
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      } else if (type === "TRUE_FALSE") {
        correctAnswer =
          questionForm.correctAnswer.trim().toLowerCase() === "true";
      } else if (type === "SHORT_ANSWER") {
        correctAnswer = questionForm.correctAnswer.trim();
      }

      const payload = {
        questionType: type,
        prompt: questionForm.prompt.trim(),
        options,
        correctAnswer,
        explanation: nullableText(questionForm.explanation),
        points: Number(questionForm.points),
        position: Number(questionForm.position),
      };

      if (editingQuestionId !== null) {
        await request(`/questions/${editingQuestionId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/questions", {
          method: "POST",
          body: JSON.stringify({
            assessmentId: selectedAssessment.id,
            ...payload,
          }),
        });
      }

      await loadContent();
      resetQuestion();
      setNotice("Question saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="instructor-panel">
        <p>Loading learning resources and assessments…</p>
      </section>
    );
  }

  if (error && !lesson) {
    return (
      <section className="instructor-panel">
        <div className="instructor-alert" role="alert">
          {error}
        </div>
        <button
          type="button"
          className="instructor-secondary-button"
          onClick={loadContent}
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="instructor-panel instructor-learning-content">
      <div className="instructor-panel-heading">
        <div>
          <p className="instructor-eyebrow">LEARNING MATERIALS</p>
          <h3>Resources and assessments</h3>
          <p className="instructor-muted">
            {lesson?.lesson?.title || "Selected lesson"}
          </p>
        </div>
        <button
          type="button"
          className="instructor-secondary-button"
          onClick={loadContent}
          disabled={busy}
        >
          ↻ Refresh
        </button>
      </div>

      {!canEdit && (
        <div className="instructor-notice" role="status">
          <strong>Read-only content</strong>
          <p>
            This program is awaiting review or has been approved. Resources,
            assessments and questions cannot be changed.
          </p>
        </div>
      )}

      {error && (
        <div className="instructor-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="instructor-notice" role="status">
          {notice}
        </div>
      )}

      <div className="instructor-learning-section">
        <div className="instructor-panel-heading">
          <div>
            <p className="instructor-eyebrow">RESOURCES</p>
            <h4>{resources.length} resources</h4>
          </div>
          {canEdit && (
            <button
              type="button"
              className="instructor-secondary-button"
              onClick={() => {
                resetResource();
                setResourceForm({
                  ...emptyResource,
                  position: resources.length,
                });
                setResourceFormOpen(true);
                setNotice("");
              }}
            >
              + Add resource
            </button>
          )}
        </div>

        {resources.length === 0 ? (
          <div className="instructor-empty">
            <p>No resources have been added to this lesson.</p>
          </div>
        ) : (
          <div className="instructor-studio-lesson-list">
            {resources.map((resource) => (
              <article className="instructor-studio-lesson" key={resource.id}>
                <div>
                  <h4>{resource.title}</h4>
                  <p>
                    {resource.resourceType} ·{" "}
                    {resource.releasePhase.replaceAll("_", " ")}
                    {" · Position "}
                    {resource.position}
                  </p>
                  {resource.description && <p>{resource.description}</p>}
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    Open resource ↗
                  </a>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    className="instructor-secondary-button"
                    disabled={busy}
                    onClick={() => editResource(resource)}
                  >
                    Edit
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {resourceFormOpen && canEdit && (
          <form
            className="instructor-program-form instructor-studio-form"
            onSubmit={saveResource}
          >
            <h4>{editingResourceId ? "Edit resource" : "New resource"}</h4>
            <Field label="Title">
              <input
                required
                minLength={2}
                maxLength={191}
                value={resourceForm.title}
                onChange={(e) =>
                  setResourceForm({ ...resourceForm, title: e.target.value })
                }
              />
            </Field>
            <Field label="Resource type">
              <select
                value={resourceForm.resourceType}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    resourceType: e.target.value,
                  })
                }
              >
                {[
                  "PDF",
                  "DOCUMENT",
                  "VIDEO",
                  "AUDIO",
                  "LINK",
                  "IMAGE",
                  "OTHER",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="URL" wide>
              <input
                required
                type="url"
                maxLength={2048}
                placeholder="https://…"
                value={resourceForm.url}
                onChange={(e) =>
                  setResourceForm({ ...resourceForm, url: e.target.value })
                }
              />
            </Field>
            <Field label="Release timing">
              <select
                value={resourceForm.releasePhase}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    releasePhase: e.target.value,
                  })
                }
              >
                <option value="PREPARATION">Before session</option>
                <option value="AFTER_SESSION">After session</option>
              </select>
            </Field>
            <Field label="Position">
              <input
                type="number"
                min="0"
                max="10000"
                required
                value={resourceForm.position}
                onChange={(e) =>
                  setResourceForm({ ...resourceForm, position: e.target.value })
                }
              />
            </Field>
            <Field label="Description" wide>
              <textarea
                rows={3}
                maxLength={10000}
                value={resourceForm.description}
                onChange={(e) =>
                  setResourceForm({
                    ...resourceForm,
                    description: e.target.value,
                  })
                }
              />
            </Field>
            <Actions
              busy={busy}
              submitLabel={
                editingResourceId ? "Save resource" : "Create draft resource"
              }
              onCancel={resetResource}
            />
          </form>
        )}
      </div>

      <div className="instructor-learning-section">
        <div className="instructor-panel-heading">
          <div>
            <p className="instructor-eyebrow">ASSESSMENTS</p>
            <h4>{assessments.length} assessments</h4>
          </div>
          {canEdit && (
            <button
              type="button"
              className="instructor-secondary-button"
              onClick={() => {
                resetAssessment();
                setAssessmentForm(emptyAssessment);
                setAssessmentFormOpen(true);
                setNotice("");
              }}
            >
              + Add assessment
            </button>
          )}
        </div>

        {assessments.length === 0 ? (
          <div className="instructor-empty">
            <p>No assessments for this lesson yet.</p>
          </div>
        ) : (
          <div className="instructor-studio-lesson-list">
            {assessments.map((assessment) => (
              <article
                className={`instructor-studio-lesson ${assessment.id === selectedAssessmentId ? "active" : ""}`}
                key={assessment.id}
              >
                <button
                  type="button"
                  className="instructor-studio-module-select"
                  onClick={() => {
                    setSelectedAssessmentId(assessment.id);
                    setQuestionFormOpen(false);
                  }}
                >
                  <span>
                    <strong>{assessment.title}</strong>
                    <small>
                      {assessment.assessmentType.replaceAll("_", " ")} ·{" "}
                      {assessment.questions?.length ?? 0} questions ·{" "}
                      {assessment.maxScore ?? "No max"} points ·{" "}
                      {assessment.isPublished ? "Published" : "Unpublished"}
                    </small>
                  </span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="instructor-secondary-button"
                    disabled={busy}
                    onClick={() => editAssessment(assessment)}
                  >
                    Edit
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {assessmentFormOpen && canEdit && (
          <form
            className="instructor-program-form instructor-studio-form"
            onSubmit={saveAssessment}
          >
            <h4>
              {editingAssessmentId ? "Edit assessment" : "New assessment"}
            </h4>
            <Field label="Title" wide>
              <input
                required
                minLength={2}
                maxLength={191}
                value={assessmentForm.title}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    title: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Type">
              <select
                value={assessmentForm.assessmentType}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    assessmentType: e.target.value,
                  })
                }
              >
                <option value="HOMEWORK">Homework</option>
                <option value="QUIZ">Quiz</option>
                <option value="PRACTICE">Practice</option>
                <option value="MOCK_EXAM">Mock exam</option>
              </select>
            </Field>
            <Field label="Release timing">
              <select
                value={assessmentForm.releasePhase}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    releasePhase: e.target.value,
                  })
                }
              >
                <option value="PREPARATION">Before session</option>
                <option value="AFTER_SESSION">After session</option>
              </select>
            </Field>
            <Field label="Maximum score">
              <input
                type="number"
                min="1"
                value={assessmentForm.maxScore}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    maxScore: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Passing score">
              <input
                type="number"
                min="0"
                value={assessmentForm.passingScore}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    passingScore: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Time limit (minutes)">
              <input
                type="number"
                min="1"
                max="1440"
                value={assessmentForm.timeLimitMinutes}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    timeLimitMinutes: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Deadline">
              <input
                type="datetime-local"
                value={assessmentForm.dueAt}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    dueAt: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Description" wide>
              <textarea
                rows={3}
                value={assessmentForm.description}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    description: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Instructions for students" wide>
              <textarea
                rows={3}
                value={assessmentForm.instructions}
                onChange={(e) =>
                  setAssessmentForm({
                    ...assessmentForm,
                    instructions: e.target.value,
                  })
                }
              />
            </Field>
            <Actions
              busy={busy}
              submitLabel={
                editingAssessmentId
                  ? "Save assessment"
                  : "Create draft assessment"
              }
              onCancel={resetAssessment}
            />
          </form>
        )}
      </div>

      {selectedAssessment && (
        <div className="instructor-learning-section">
          <div className="instructor-panel-heading">
            <div>
              <p className="instructor-eyebrow">QUESTIONS</p>
              <h4>{selectedAssessment.title}</h4>
            </div>
            {canEdit && (
              <button
                type="button"
                className="instructor-secondary-button"
                onClick={() => {
                  resetQuestion();
                  setQuestionForm({
                    ...emptyQuestion,
                    position: String(
                      (selectedAssessment.questions?.length ?? 0) + 1,
                    ),
                  });
                  setQuestionFormOpen(true);
                  setNotice("");
                }}
              >
                + Add question
              </button>
            )}
          </div>

          {!selectedAssessment.questions?.length ? (
            <div className="instructor-empty">
              <p>No questions have been added yet.</p>
            </div>
          ) : (
            <div className="instructor-studio-lesson-list">
              {selectedAssessment.questions.map((question) => (
                <article className="instructor-studio-lesson" key={question.id}>
                  <div>
                    <h4>
                      {question.position}. {question.prompt}
                    </h4>
                    <p>
                      {question.questionType.replaceAll("_", " ")} ·{" "}
                      {question.points} points
                    </p>
                    {Array.isArray(question.options) && (
                      <ul>
                        {question.options.map((option) => (
                          <li key={option}>{option}</li>
                        ))}
                      </ul>
                    )}
                    {question.explanation && (
                      <p>Marking guidance: {question.explanation}</p>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      className="instructor-secondary-button"
                      disabled={busy}
                      onClick={() => editQuestion(question)}
                    >
                      Edit
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}

          {questionFormOpen && canEdit && (
            <form
              className="instructor-program-form instructor-studio-form"
              onSubmit={saveQuestion}
            >
              <h4>{editingQuestionId ? "Edit question" : "New question"}</h4>
              <Field label="Question type">
                <select
                  value={questionForm.questionType}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      questionType: e.target.value,
                      options: "Option A\nOption B",
                      correctAnswer: "",
                    })
                  }
                >
                  <option value="SINGLE_CHOICE">Single choice</option>
                  <option value="MULTIPLE_CHOICE">Multiple choice</option>
                  <option value="TRUE_FALSE">True / False</option>
                  <option value="SHORT_ANSWER">Short answer</option>
                  <option value="LONG_ANSWER">Long answer / essay</option>
                </select>
              </Field>
              <Field label="Points">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={questionForm.points}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, points: e.target.value })
                  }
                />
              </Field>
              <Field label="Position">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={questionForm.position}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      position: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Question prompt" wide>
                <textarea
                  rows={4}
                  required
                  minLength={2}
                  maxLength={20000}
                  value={questionForm.prompt}
                  onChange={(e) =>
                    setQuestionForm({ ...questionForm, prompt: e.target.value })
                  }
                />
              </Field>
              {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(
                questionForm.questionType,
              ) && (
                <Field label="Options (one per line)" wide>
                  <textarea
                    rows={4}
                    required
                    value={questionForm.options}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        options: e.target.value,
                      })
                    }
                  />
                </Field>
              )}
              {questionForm.questionType !== "LONG_ANSWER" && (
                <Field
                  label={
                    questionForm.questionType === "MULTIPLE_CHOICE"
                      ? "Correct options (comma-separated)"
                      : questionForm.questionType === "TRUE_FALSE"
                        ? "Correct answer: true or false"
                        : questionForm.questionType === "SINGLE_CHOICE"
                          ? "Correct option (exact text)"
                          : "Expected answer"
                  }
                  wide
                >
                  <input
                    required
                    value={questionForm.correctAnswer}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        correctAnswer: e.target.value,
                      })
                    }
                    placeholder={
                      questionForm.questionType === "TRUE_FALSE" ? "true" : ""
                    }
                  />
                </Field>
              )}
              <Field label="Explanation / marking guidance" wide>
                <textarea
                  rows={3}
                  value={questionForm.explanation}
                  onChange={(e) =>
                    setQuestionForm({
                      ...questionForm,
                      explanation: e.target.value,
                    })
                  }
                />
              </Field>
              <Actions
                busy={busy}
                submitLabel={
                  editingQuestionId ? "Save question" : "Add question"
                }
                onCancel={resetQuestion}
              />
            </form>
          )}
        </div>
      )}
    </section>
  );
}
