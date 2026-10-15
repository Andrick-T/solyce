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
      ...(options.method && options.method !== "GET"
        ? { Origin: window.location.origin }
        : {}),
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

const initialModule = {
  title: "",
  description: "",
  position: "1",
};

const initialLesson = {
  title: "",
  description: "",
  objectives: "",
  preparationContent: "",
  content: "",
  estimatedMinutes: "90",
  position: "1",
};

const initialAssessment = {
  title: "",
  description: "",
  assessmentType: "HOMEWORK",
  releasePhase: "AFTER_SESSION",
  instructions: "",
  maxScore: "20",
  passingScore: "10",
  timeLimitMinutes: "",
};

const initialQuestion = {
  questionType: "LONG_ANSWER",
  prompt: "",
  options: "",
  correctAnswer: "",
  explanation: "",
  points: "1",
  position: "1",
};

function Panel({ title, description, children, actions }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
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

function Status({ published }) {
  return (
    <span
      className={`admin-status ${published ? "status-verified" : "status-pending"}`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

export default function LearningStudio() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [resources, setResources] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const [moduleForm, setModuleForm] = useState(initialModule);
  const [lessonForm, setLessonForm] = useState(initialLesson);
  const [assessmentForm, setAssessmentForm] = useState(initialAssessment);
  const [questionForm, setQuestionForm] = useState(initialQuestion);
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    resourceType: "LINK",
    url: "",
    releasePhase: "AFTER_SESSION",
    position: "1",
  });

  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState(null);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editingResourceId, setEditingResourceId] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedModule = modules.find(
    (item) => String(item.id) === String(selectedModuleId),
  );

  const selectedLesson = selectedModule?.lessons?.find(
    (item) => String(item.id) === String(selectedLessonId),
  );

  const selectedAssessment = assessments.find(
    (item) => String(item.id) === String(selectedAssessmentId),
  );

  const flash = (message) => {
    setNotice(message);
    setError("");
  };

  const loadCourses = useCallback(async () => {
    const result = await request("/admin/courses");
    const items = result.data || [];
    setCourses(items);

    setCourseId((current) => {
      if (items.some((item) => String(item.id) === String(current))) {
        return current;
      }
      return items[0] ? String(items[0].id) : "";
    });
  }, []);

  const loadModules = useCallback(async () => {
    if (!courseId) {
      setModules([]);
      setSelectedModuleId("");
      setSelectedLessonId("");
      return;
    }

    const result = await request(
      `/admin/pedagogy/modules?courseId=${encodeURIComponent(courseId)}`,
    );

    const items = result.data || [];
    setModules(items);

    setSelectedModuleId((current) => {
      if (items.some((item) => String(item.id) === String(current))) {
        return current;
      }
      return items[0] ? String(items[0].id) : "";
    });
  }, [courseId]);

  const loadLessonContent = useCallback(async () => {
    if (!selectedLessonId) {
      setAssessments([]);
      setResources([]);
      setSelectedAssessmentId("");
      return;
    }

    const [assessmentResult, resourceResult] = await Promise.all([
      request(
        `/admin/learning-content/assessments?lessonId=${encodeURIComponent(selectedLessonId)}`,
      ),
      request(
        `/admin/learning-content/resources?lessonId=${encodeURIComponent(selectedLessonId)}`,
      ),
    ]);

    setAssessments(assessmentResult.data || []);
    setResources(resourceResult.data || []);
  }, [selectedLessonId]);

  const loadQuestions = useCallback(async () => {
    if (!selectedAssessmentId) {
      setQuestions([]);
      return;
    }

    const result = await request(
      `/admin/learning-content/assessments/${selectedAssessmentId}/questions`,
    );

    setQuestions(result.data || []);
  }, [selectedAssessmentId]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await request("/admin/courses");
        if (!active) return;

        const items = result.data || [];
        setCourses(items);
        setCourseId((current) =>
          items.some((item) => String(item.id) === String(current))
            ? current
            : items[0]
              ? String(items[0].id)
              : "",
        );
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!courseId) {
        setModules([]);
        setSelectedModuleId("");
        setSelectedLessonId("");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await request(
          `/admin/pedagogy/modules?courseId=${encodeURIComponent(courseId)}`,
        );

        if (!active) return;

        const items = result.data || [];
        setModules(items);
        setSelectedModuleId((current) =>
          items.some((item) => String(item.id) === String(current))
            ? current
            : items[0]
              ? String(items[0].id)
              : "",
        );
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [courseId]);

  useEffect(() => {
    if (!selectedModule) {
      setSelectedLessonId("");
      return;
    }

    setSelectedLessonId((current) =>
      selectedModule.lessons?.some(
        (item) => String(item.id) === String(current),
      )
        ? current
        : selectedModule.lessons?.[0]
          ? String(selectedModule.lessons[0].id)
          : "",
    );
  }, [selectedModuleId, modules]);

  useEffect(() => {
    loadLessonContent().catch((err) => setError(err.message));
  }, [loadLessonContent]);

  useEffect(() => {
    loadQuestions().catch((err) => setError(err.message));
  }, [loadQuestions]);

  function resetModuleForm() {
    setModuleForm({
      ...initialModule,
      position: String((modules.length || 0) + 1),
    });
    setEditingModuleId(null);
  }

  function resetLessonForm() {
    setLessonForm({
      ...initialLesson,
      position: String((selectedModule?.lessons?.length || 0) + 1),
    });
    setEditingLessonId(null);
  }

  function resetAssessmentForm() {
    setAssessmentForm(initialAssessment);
    setEditingAssessmentId(null);
  }

  function resetQuestionForm() {
    setQuestionForm({
      ...initialQuestion,
      position: String(questions.length + 1),
    });
    setEditingQuestionId(null);
  }

  function resetResourceForm() {
    setResourceForm({
      title: "",
      description: "",
      resourceType: "LINK",
      url: "",
      releasePhase: "AFTER_SESSION",
      position: String(resources.length + 1),
    });
    setEditingResourceId(null);
  }

  async function saveModule(event) {
    event.preventDefault();
    if (!courseId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        title: moduleForm.title.trim(),
        description: moduleForm.description.trim() || null,
        position: Number(moduleForm.position),
      };

      const result = editingModuleId
        ? await request(`/admin/pedagogy/modules/${editingModuleId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await request("/admin/pedagogy/modules", {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              courseId: Number(courseId),
              isPublished: false,
            }),
          });

      await loadModules();
      if (result.data?.id) setSelectedModuleId(String(result.data.id));
      resetModuleForm();
      flash(editingModuleId ? "Module updated." : "Module created as a draft.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function editModule(module) {
    setEditingModuleId(module.id);
    setModuleForm({
      title: module.title || "",
      description: module.description || "",
      position: String(module.position || 1),
    });
  }

  async function toggleModule(module) {
    setBusy(true);
    setError("");

    try {
      await request(`/admin/pedagogy/modules/${module.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !module.isPublished }),
      });
      await loadModules();
      flash(
        module.isPublished ? "Module moved to draft." : "Module published.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveLesson(event) {
    event.preventDefault();
    if (!selectedModuleId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim() || null,
        objectives: lessonForm.objectives.trim() || null,
        preparationContent: lessonForm.preparationContent || null,
        content: lessonForm.content || null,
        estimatedMinutes: lessonForm.estimatedMinutes
          ? Number(lessonForm.estimatedMinutes)
          : null,
        position: Number(lessonForm.position),
      };

      const result = editingLessonId
        ? await request(`/admin/pedagogy/lessons/${editingLessonId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await request("/admin/pedagogy/lessons", {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              moduleId: Number(selectedModuleId),
              isPublished: false,
            }),
          });

      await loadModules();
      if (result.data?.id) setSelectedLessonId(String(result.data.id));
      resetLessonForm();
      flash(editingLessonId ? "Lesson updated." : "Lesson created as a draft.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function editLesson(lesson) {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title || "",
      description: lesson.description || "",
      objectives: lesson.objectives || "",
      preparationContent: lesson.preparationContent || "",
      content: lesson.content || "",
      estimatedMinutes: String(lesson.estimatedMinutes ?? 90),
      position: String(lesson.position || 1),
    });
  }

  async function toggleLesson(lesson) {
    setBusy(true);
    setError("");

    try {
      await request(`/admin/pedagogy/lessons/${lesson.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !lesson.isPublished }),
      });
      await loadModules();
      flash(
        lesson.isPublished ? "Lesson moved to draft." : "Lesson published.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAssessment(event) {
    event.preventDefault();
    if (!selectedLessonId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        title: assessmentForm.title.trim(),
        description: assessmentForm.description.trim() || null,
        assessmentType: assessmentForm.assessmentType,
        releasePhase: assessmentForm.releasePhase,
        instructions: assessmentForm.instructions.trim() || null,
        maxScore: assessmentForm.maxScore
          ? Number(assessmentForm.maxScore)
          : null,
        passingScore: assessmentForm.passingScore
          ? Number(assessmentForm.passingScore)
          : null,
        timeLimitMinutes: assessmentForm.timeLimitMinutes
          ? Number(assessmentForm.timeLimitMinutes)
          : null,
      };

      const result = editingAssessmentId
        ? await request(
            `/admin/learning-content/assessments/${editingAssessmentId}`,
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            },
          )
        : await request("/admin/learning-content/assessments", {
            method: "POST",
            body: JSON.stringify({
              ...payload,
              lessonId: Number(selectedLessonId),
              isPublished: false,
            }),
          });

      await loadLessonContent();
      if (result.data?.id) setSelectedAssessmentId(String(result.data.id));
      resetAssessmentForm();
      flash(
        editingAssessmentId
          ? "Assessment updated."
          : "Assessment created as a draft.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function editAssessment(assessment) {
    setEditingAssessmentId(assessment.id);
    setSelectedAssessmentId(String(assessment.id));
    setAssessmentForm({
      title: assessment.title || "",
      description: assessment.description || "",
      assessmentType: assessment.assessmentType || "HOMEWORK",
      releasePhase: assessment.releasePhase || "AFTER_SESSION",
      instructions: assessment.instructions || "",
      maxScore: String(assessment.maxScore ?? 20),
      passingScore: String(assessment.passingScore ?? 10),
      timeLimitMinutes: String(assessment.timeLimitMinutes ?? ""),
    });
  }

  async function toggleAssessment(assessment) {
    setBusy(true);
    setError("");

    try {
      await request(`/admin/learning-content/assessments/${assessment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !assessment.isPublished }),
      });
      await loadLessonContent();
      flash(
        assessment.isPublished
          ? "Assessment moved to draft."
          : "Assessment published.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function parseQuestionData() {
    const type = questionForm.questionType;
    let options = null;
    let correctAnswer = null;

    if (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") {
      const choices = questionForm.options
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);

      if (choices.length < 2) {
        throw new Error("Enter at least two answer options, one per line.");
      }

      options = choices;

      const answerParts = questionForm.correctAnswer
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (!answerParts.length) {
        throw new Error("Enter the correct answer.");
      }

      correctAnswer = type === "MULTIPLE_CHOICE" ? answerParts : answerParts[0];
    } else if (type === "TRUE_FALSE") {
      if (
        !["true", "false"].includes(questionForm.correctAnswer.toLowerCase())
      ) {
        throw new Error("For True/False, enter true or false as the answer.");
      }
      options = ["true", "false"];
      correctAnswer = questionForm.correctAnswer.toLowerCase() === "true";
    } else if (type === "SHORT_ANSWER") {
      correctAnswer = questionForm.correctAnswer.trim() || null;
    }

    return { options, correctAnswer };
  }

  async function saveQuestion(event) {
    event.preventDefault();
    if (!selectedAssessmentId) return;

    setBusy(true);
    setError("");

    try {
      const { options, correctAnswer } = parseQuestionData();

      const payload = {
        questionType: questionForm.questionType,
        prompt: questionForm.prompt.trim(),
        options,
        correctAnswer,
        explanation: questionForm.explanation.trim() || null,
        points: Number(questionForm.points),
        position: Number(questionForm.position),
      };

      if (editingQuestionId) {
        await request(
          `/admin/learning-content/questions/${editingQuestionId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await request("/admin/learning-content/questions", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            assessmentId: Number(selectedAssessmentId),
          }),
        });
      }

      await loadQuestions();
      resetQuestionForm();
      flash(editingQuestionId ? "Question updated." : "Question added.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function editQuestion(question) {
    setEditingQuestionId(question.id);
    setQuestionForm({
      questionType: question.questionType,
      prompt: question.prompt || "",
      options: Array.isArray(question.options)
        ? question.options.join("\n")
        : "",
      correctAnswer: Array.isArray(question.correctAnswer)
        ? question.correctAnswer.join(", ")
        : typeof question.correctAnswer === "boolean"
          ? String(question.correctAnswer)
          : question.correctAnswer == null
            ? ""
            : String(question.correctAnswer),
      explanation: question.explanation || "",
      points: String(question.points ?? 1),
      position: String(question.position || 1),
    });
  }

  async function toggleQuestion(question) {
    setBusy(true);
    setError("");

    try {
      await request(`/admin/learning-content/questions/${question.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          prompt: question.prompt,
          position: question.position,
        }),
      });
      flash("Question saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveResource(event) {
    event.preventDefault();
    if (!selectedLessonId) return;

    setBusy(true);
    setError("");

    try {
      const payload = {
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim() || null,
        resourceType: resourceForm.resourceType,
        url: resourceForm.url.trim(),
        releasePhase: resourceForm.releasePhase,
        position: Number(resourceForm.position),
      };

      if (editingResourceId) {
        await request(
          `/admin/learning-content/resources/${editingResourceId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await request("/admin/learning-content/resources", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            lessonId: Number(selectedLessonId),
            isPublished: false,
          }),
        });
      }

      await loadLessonContent();
      resetResourceForm();
      flash(
        editingResourceId ? "Resource updated." : "Resource added as a draft.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function editResource(resource) {
    setEditingResourceId(resource.id);
    setResourceForm({
      title: resource.title || "",
      description: resource.description || "",
      resourceType: resource.resourceType || "LINK",
      url: resource.url || "",
      releasePhase: resource.releasePhase || "AFTER_SESSION",
      position: String(resource.position || 0),
    });
  }

  async function toggleResource(resource) {
    setBusy(true);
    setError("");

    try {
      await request(`/admin/learning-content/resources/${resource.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !resource.isPublished }),
      });
      await loadLessonContent();
      flash(
        resource.isPublished
          ? "Resource moved to draft."
          : "Resource published.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="learning-studio">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">SOLYCE / PEDAGOGY</p>
          <h1>Learning Studio</h1>
          <p>
            Build course modules, lessons, learning materials and assessments.
            Drafts remain unpublished until you explicitly publish them.
          </p>
        </div>
        <button
          className="admin-button subtle"
          disabled={loading || busy}
          onClick={async () => {
            setLoading(true);
            setError("");
            try {
              await loadCourses();
              await loadModules();
              await loadLessonContent();
              await loadQuestions();
              flash("Learning content refreshed.");
            } catch (err) {
              setError(err.message);
            } finally {
              setLoading(false);
            }
          }}
        >
          ↻ Refresh
        </button>
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

      <Panel
        title="1. Select a program"
        description="Choose the program whose curriculum you want to manage."
      >
        <Field label="Program" wide>
          <select
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setSelectedAssessmentId("");
              setNotice("");
            }}
            disabled={loading}
          >
            <option value="">Select a program</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} — {course.examType}
              </option>
            ))}
          </select>
        </Field>
        {!courses.length && !loading && (
          <p className="admin-form-note">
            No programs found. Create a program in the Programs section first.
          </p>
        )}
      </Panel>

      {!!courseId && (
        <>
          <Panel
            title="2. Modules"
            description="Organise the curriculum into ordered learning modules."
          >
            <div className="learning-list">
              {modules.map((module) => (
                <div
                  className={`learning-list-item ${String(module.id) === String(selectedModuleId) ? "selected" : ""}`}
                  key={module.id}
                >
                  <button
                    type="button"
                    className="learning-item-main"
                    onClick={() => setSelectedModuleId(String(module.id))}
                  >
                    <strong>
                      {module.position}. {module.title}
                    </strong>
                    <span>
                      {module.lessons?.length || 0} lessons ·{" "}
                      <Status published={module.isPublished} />
                    </span>
                  </button>
                  <div className="learning-item-actions">
                    <button
                      className="admin-button subtle"
                      disabled={busy}
                      onClick={() => editModule(module)}
                    >
                      Edit
                    </button>
                    <button
                      className="admin-button subtle"
                      disabled={busy}
                      onClick={() => toggleModule(module)}
                    >
                      {module.isPublished ? "Unpublish" : "Publish"}
                    </button>
                  </div>
                </div>
              ))}
              {!modules.length && (
                <p className="admin-empty">No modules yet.</p>
              )}
            </div>

            <form className="admin-form learning-form" onSubmit={saveModule}>
              <h3>{editingModuleId ? "Edit module" : "Create module"}</h3>
              <Field label="Module title" wide>
                <input
                  required
                  minLength={2}
                  maxLength={191}
                  value={moduleForm.title}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, title: e.target.value })
                  }
                />
              </Field>
              <Field label="Description" wide>
                <textarea
                  rows={3}
                  value={moduleForm.description}
                  onChange={(e) =>
                    setModuleForm({
                      ...moduleForm,
                      description: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Position">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={moduleForm.position}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, position: e.target.value })
                  }
                />
              </Field>
              <div className="admin-form-actions">
                <button className="admin-button primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : editingModuleId
                      ? "Save changes"
                      : "Create draft module"}
                </button>
                {editingModuleId && (
                  <button
                    type="button"
                    className="admin-button subtle"
                    onClick={resetModuleForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </Panel>

          {!!selectedModule && (
            <Panel
              title={`3. Lessons — ${selectedModule.title}`}
              description="Add lesson objectives, preparation materials and session content."
            >
              <div className="learning-list">
                {(selectedModule.lessons || []).map((lesson) => (
                  <div
                    key={lesson.id}
                    className={`learning-list-item ${String(lesson.id) === String(selectedLessonId) ? "selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="learning-item-main"
                      onClick={() => setSelectedLessonId(String(lesson.id))}
                    >
                      <strong>
                        {lesson.position}. {lesson.title}
                      </strong>
                      <span>
                        {lesson._count?.resources || 0} resources ·{" "}
                        {lesson._count?.assessments || 0} assessments ·{" "}
                        <Status published={lesson.isPublished} />
                      </span>
                    </button>
                    <div className="learning-item-actions">
                      <button
                        className="admin-button subtle"
                        disabled={busy}
                        onClick={() => {
                          setSelectedLessonId(String(lesson.id));
                          editLesson(lesson);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="admin-button subtle"
                        disabled={busy}
                        onClick={() => toggleLesson(lesson)}
                      >
                        {lesson.isPublished ? "Unpublish" : "Publish"}
                      </button>
                    </div>
                  </div>
                ))}
                {!selectedModule.lessons?.length && (
                  <p className="admin-empty">No lessons in this module yet.</p>
                )}
              </div>

              <form className="admin-form learning-form" onSubmit={saveLesson}>
                <h3>{editingLessonId ? "Edit lesson" : "Create lesson"}</h3>
                <Field label="Lesson title" wide>
                  <input
                    required
                    minLength={2}
                    maxLength={191}
                    value={lessonForm.title}
                    onChange={(e) =>
                      setLessonForm({ ...lessonForm, title: e.target.value })
                    }
                  />
                </Field>
                <Field label="Short description" wide>
                  <textarea
                    rows={2}
                    value={lessonForm.description}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        description: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Learning objectives" wide>
                  <textarea
                    rows={3}
                    value={lessonForm.objectives}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        objectives: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Preparation content" wide>
                  <textarea
                    rows={4}
                    value={lessonForm.preparationContent}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        preparationContent: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Lesson content" wide>
                  <textarea
                    rows={5}
                    value={lessonForm.content}
                    onChange={(e) =>
                      setLessonForm({ ...lessonForm, content: e.target.value })
                    }
                  />
                </Field>
                <Field label="Estimated duration (minutes)">
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={lessonForm.estimatedMinutes}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        estimatedMinutes: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Position">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={lessonForm.position}
                    onChange={(e) =>
                      setLessonForm({ ...lessonForm, position: e.target.value })
                    }
                  />
                </Field>
                <div className="admin-form-actions">
                  <button className="admin-button primary" disabled={busy}>
                    {busy
                      ? "Saving…"
                      : editingLessonId
                        ? "Save lesson"
                        : "Create draft lesson"}
                  </button>
                  {editingLessonId && (
                    <button
                      type="button"
                      className="admin-button subtle"
                      onClick={resetLessonForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </Panel>
          )}

          {!!selectedLesson && (
            <>
              <Panel
                title={`4. Learning resources — ${selectedLesson.title}`}
                description="Attach links to PDFs, videos, audio, documents or other resources."
              >
                <div className="learning-list">
                  {resources.map((resource) => (
                    <div className="learning-list-item" key={resource.id}>
                      <div className="learning-item-main">
                        <strong>{resource.title}</strong>
                        <span>
                          {resource.resourceType} ·{" "}
                          {resource.releasePhase.replaceAll("_", " ")} ·{" "}
                          <Status published={resource.isPublished} />
                        </span>
                        <a href={resource.url} target="_blank" rel="noreferrer">
                          Open resource ↗
                        </a>
                      </div>
                      <div className="learning-item-actions">
                        <button
                          className="admin-button subtle"
                          disabled={busy}
                          onClick={() => editResource(resource)}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-button subtle"
                          disabled={busy}
                          onClick={() => toggleResource(resource)}
                        >
                          {resource.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <form
                  className="admin-form learning-form"
                  onSubmit={saveResource}
                >
                  <h3>
                    {editingResourceId ? "Edit resource" : "Add resource"}
                  </h3>
                  <Field label="Resource title" wide>
                    <input
                      required
                      minLength={2}
                      maxLength={191}
                      value={resourceForm.title}
                      onChange={(e) =>
                        setResourceForm({
                          ...resourceForm,
                          title: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="URL" wide>
                    <input
                      required
                      type="url"
                      maxLength={2048}
                      value={resourceForm.url}
                      onChange={(e) =>
                        setResourceForm({
                          ...resourceForm,
                          url: e.target.value,
                        })
                      }
                      placeholder="https://..."
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
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
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
                  <Field label="Description" wide>
                    <textarea
                      rows={2}
                      value={resourceForm.description}
                      onChange={(e) =>
                        setResourceForm({
                          ...resourceForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Position">
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={resourceForm.position}
                      onChange={(e) =>
                        setResourceForm({
                          ...resourceForm,
                          position: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="admin-form-actions">
                    <button className="admin-button primary" disabled={busy}>
                      {busy
                        ? "Saving…"
                        : editingResourceId
                          ? "Save resource"
                          : "Add draft resource"}
                    </button>
                    {editingResourceId && (
                      <button
                        type="button"
                        className="admin-button subtle"
                        onClick={resetResourceForm}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </Panel>

              <Panel
                title={`5. Assessments — ${selectedLesson.title}`}
                description="Create quizzes, practice work, homework and mock exams."
              >
                <div className="learning-list">
                  {assessments.map((assessment) => (
                    <div
                      className={`learning-list-item ${String(assessment.id) === String(selectedAssessmentId) ? "selected" : ""}`}
                      key={assessment.id}
                    >
                      <button
                        type="button"
                        className="learning-item-main"
                        onClick={() =>
                          setSelectedAssessmentId(String(assessment.id))
                        }
                      >
                        <strong>{assessment.title}</strong>
                        <span>
                          {assessment.assessmentType.replaceAll("_", " ")} ·{" "}
                          {assessment.questions?.length || 0} questions ·{" "}
                          {assessment._count?.attempts || 0} attempts ·{" "}
                          <Status published={assessment.isPublished} />
                        </span>
                      </button>
                      <div className="learning-item-actions">
                        <button
                          className="admin-button subtle"
                          disabled={busy}
                          onClick={() => editAssessment(assessment)}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-button subtle"
                          disabled={busy}
                          onClick={() => toggleAssessment(assessment)}
                        >
                          {assessment.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!assessments.length && (
                    <p className="admin-empty">
                      No assessments for this lesson yet.
                    </p>
                  )}
                </div>

                <form
                  className="admin-form learning-form"
                  onSubmit={saveAssessment}
                >
                  <h3>
                    {editingAssessmentId
                      ? "Edit assessment"
                      : "Create assessment"}
                  </h3>
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
                  <Field label="Assessment type">
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
                  <Field label="Description" wide>
                    <textarea
                      rows={2}
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
                  <div className="admin-form-actions">
                    <button className="admin-button primary" disabled={busy}>
                      {busy
                        ? "Saving…"
                        : editingAssessmentId
                          ? "Save assessment"
                          : "Create draft assessment"}
                    </button>
                    {editingAssessmentId && (
                      <button
                        type="button"
                        className="admin-button subtle"
                        onClick={resetAssessmentForm}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </Panel>

              {!!selectedAssessment && (
                <Panel
                  title={`6. Questions — ${selectedAssessment.title}`}
                  description="Long-answer questions are intended for manual grading by an administrator."
                >
                  <div className="learning-list">
                    {questions.map((question) => (
                      <div className="learning-list-item" key={question.id}>
                        <div className="learning-item-main">
                          <strong>
                            {question.position}. {question.prompt}
                          </strong>
                          <span>
                            {question.questionType.replaceAll("_", " ")} ·{" "}
                            {question.points} points
                          </span>
                        </div>
                        <div className="learning-item-actions">
                          <button
                            className="admin-button subtle"
                            disabled={busy}
                            onClick={() => editQuestion(question)}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                    {!questions.length && (
                      <p className="admin-empty">No questions added yet.</p>
                    )}
                  </div>

                  <form
                    className="admin-form learning-form"
                    onSubmit={saveQuestion}
                  >
                    <h3>
                      {editingQuestionId ? "Edit question" : "Add question"}
                    </h3>
                    <Field label="Question type">
                      <select
                        value={questionForm.questionType}
                        onChange={(e) =>
                          setQuestionForm({
                            ...questionForm,
                            questionType: e.target.value,
                            options: "",
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
                          setQuestionForm({
                            ...questionForm,
                            points: e.target.value,
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
                          setQuestionForm({
                            ...questionForm,
                            prompt: e.target.value,
                          })
                        }
                      />
                    </Field>

                    {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(
                      questionForm.questionType,
                    ) && (
                      <Field label="Answer options (one per line)" wide>
                        <textarea
                          rows={4}
                          value={questionForm.options}
                          onChange={(e) =>
                            setQuestionForm({
                              ...questionForm,
                              options: e.target.value,
                            })
                          }
                          placeholder={"Option A\nOption B\nOption C"}
                        />
                      </Field>
                    )}

                    {questionForm.questionType !== "LONG_ANSWER" && (
                      <Field
                        label={
                          questionForm.questionType === "MULTIPLE_CHOICE"
                            ? "Correct answers (comma-separated)"
                            : questionForm.questionType === "TRUE_FALSE"
                              ? "Correct answer: true or false"
                              : "Expected answer"
                        }
                        wide
                      >
                        <input
                          value={questionForm.correctAnswer}
                          onChange={(e) =>
                            setQuestionForm({
                              ...questionForm,
                              correctAnswer: e.target.value,
                            })
                          }
                          placeholder={
                            questionForm.questionType === "TRUE_FALSE"
                              ? "true"
                              : "Enter the correct answer"
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
                        placeholder="For essays, describe the grading criteria for the instructor."
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

                    <div className="admin-form-actions">
                      <button className="admin-button primary" disabled={busy}>
                        {busy
                          ? "Saving…"
                          : editingQuestionId
                            ? "Save question"
                            : "Add question"}
                      </button>
                      {editingQuestionId && (
                        <button
                          type="button"
                          className="admin-button subtle"
                          onClick={resetQuestionForm}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </Panel>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
