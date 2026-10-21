import { useCallback, useEffect, useState } from "react";
import InstructorLearningContent from "./InstructorLearningContent.jsx";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const API_PATH = "/api/instructor/pedagogy";

const emptyLesson = {
  title: "",
  description: "",
  objectives: "",
  preparationContent: "",
  content: "",
  estimatedMinutes: 30,
  position: 1,
};

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${API_PATH}${path}`, {
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

function normalizeDescription(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function isEditableStatus(status) {
  return status === "DRAFT" || status === "REJECTED";
}

export default function InstructorLearningStudio({ program, onBack }) {
  const [modules, setModules] = useState([]);
  const [course, setCourse] = useState(program);
  const [canEdit, setCanEdit] = useState(
    isEditableStatus(program?.approvalStatus),
  );

  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  const [moduleForm, setModuleForm] = useState({
    title: "",
    description: "",
    position: 1,
  });

  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editingLessonId, setEditingLessonId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [moduleFormOpen, setModuleFormOpen] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonViewOpen, setLessonViewOpen] = useState(false);

  const loadCurriculum = useCallback(async () => {
    try {
      const result = await request(
        `/modules?courseId=${encodeURIComponent(program.id)}`,
      );
      setError("");

      const resultCourse = result.course ?? program;
      const nextModules = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.modules)
          ? result.modules
          : [];

      setCourse(resultCourse);
      setModules(nextModules);

      // Fail closed if the server does not explicitly allow editing.
      setCanEdit(
        result.canEdit === true &&
          isEditableStatus(resultCourse.approvalStatus),
      );

      setSelectedModuleId((currentId) => {
        if (nextModules.some((module) => module.id === currentId)) {
          return currentId;
        }

        return nextModules[0]?.id ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    const scheduledLoad = Promise.resolve().then(loadCurriculum);
    return () => {
      void scheduledLoad;
    };
  }, [loadCurriculum]);

  const selectedModule =
    modules.find((module) => module.id === selectedModuleId) ?? null;

  const lessons = selectedModule?.lessons ?? [];

  function resetModuleForm() {
    setModuleForm({
      title: "",
      description: "",
      position: modules.length + 1,
    });
    setEditingModuleId(null);
    setModuleFormOpen(false);
  }

  function startEditModule(module) {
    setModuleForm({
      title: module.title ?? "",
      description: module.description ?? "",
      position: module.position ?? 1,
    });
    setEditingModuleId(module.id);
    setModuleFormOpen(true);
    setNotice("");
  }

  async function saveModule(event) {
    event.preventDefault();
    if (!canEdit || saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title: moduleForm.title.trim(),
        description: normalizeDescription(moduleForm.description),
        position: Number(moduleForm.position),
      };

      if (editingModuleId !== null) {
        await request(`/modules/${editingModuleId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/modules", {
          method: "POST",
          body: JSON.stringify({
            courseId: Number(program.id),
            ...payload,
          }),
        });
      }

      await loadCurriculum();
      resetModuleForm();
      setNotice(
        editingModuleId !== null
          ? "Module updated successfully."
          : "Module created successfully.",
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function resetLessonForm() {
    setLessonForm({
      ...emptyLesson,
      position: lessons.length + 1,
    });
    setEditingLessonId(null);
    setLessonFormOpen(false);
  }

  function startNewLesson() {
    setLessonForm({
      ...emptyLesson,
      position: lessons.length + 1,
    });
    setEditingLessonId(null);
    setLessonFormOpen(true);
    setNotice("");
  }

  async function startEditLesson(lesson) {
    if (!canEdit) {
      await viewLesson(lesson);
      return;
    }

    setError("");
    setNotice("");
    setLessonViewOpen(false);

    try {
      const result = await request(`/lessons/${lesson.id}`);
      const details = result.data ?? result.lesson ?? result;

      setLessonForm({
        title: details.title ?? "",
        description: details.description ?? "",
        objectives: details.objectives ?? "",
        preparationContent: details.preparationContent ?? "",
        content: details.content ?? "",
        estimatedMinutes: details.estimatedMinutes ?? 30,
        position: details.position ?? 1,
      });

      setEditingLessonId(lesson.id);
      setSelectedLessonId(lesson.id);
      setLessonFormOpen(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function viewLesson(lesson) {
    setError("");
    setNotice("");
    setLessonFormOpen(false);
    setEditingLessonId(null);
    setLessonViewOpen(false);

    try {
      const result = await request(`/lessons/${lesson.id}`);
      const details = result.data ?? result.lesson ?? result;

      setLessonForm({
        title: details.title ?? "",
        description: details.description ?? "",
        objectives: details.objectives ?? "",
        preparationContent: details.preparationContent ?? "",
        content: details.content ?? "",
        estimatedMinutes: details.estimatedMinutes ?? 30,
        position: details.position ?? 1,
      });

      setSelectedLessonId(lesson.id);
      setLessonViewOpen(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function saveLesson(event) {
    event.preventDefault();
    if (!canEdit || saving || !selectedModule) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title: lessonForm.title.trim(),
        description: normalizeDescription(lessonForm.description),
        objectives: normalizeDescription(lessonForm.objectives),
        preparationContent: normalizeDescription(lessonForm.preparationContent),
        content: lessonForm.content,
        estimatedMinutes: Number(lessonForm.estimatedMinutes),
        position: Number(lessonForm.position),
      };

      if (editingLessonId !== null) {
        await request(`/lessons/${editingLessonId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await request("/lessons", {
          method: "POST",
          body: JSON.stringify({
            moduleId: Number(selectedModule.id),
            ...payload,
          }),
        });
      }

      const wasEditing = editingLessonId !== null;

      await loadCurriculum();
      resetLessonForm();

      setNotice(
        wasEditing
          ? "Lesson updated successfully."
          : "Lesson created successfully.",
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function selectModule(module) {
    setSelectedModuleId(module.id);
    setSelectedLessonId(null);
    setLessonFormOpen(false);
    setLessonViewOpen(false);
    setEditingLessonId(null);
    setError("");
    setNotice("");
  }

  return (
    <section className="instructor-panel instructor-studio">
      <div className="instructor-panel-heading">
        <div>
          <p className="instructor-eyebrow">CURRICULUM DESIGN</p>
          <h2>{course?.title || program.title}</h2>
          <p className="instructor-muted">
            Organize your program into structured modules and lessons.
          </p>
        </div>

        <button
          type="button"
          className="instructor-secondary-button"
          onClick={onBack}
        >
          ← Back to programs
        </button>
      </div>

      {!canEdit && (
        <div className="instructor-notice" role="status">
          <strong>Read-only curriculum</strong>
          <p>
            This program is{" "}
            {course?.approvalStatus?.toLowerCase().replaceAll("_", " ") ||
              "locked"}
            . Only draft or rejected programs can be edited here. Program
            approval and publication remain under administrator control.
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

      <div className="instructor-studio-toolbar">
        <div>
          <strong>{modules.length} modules</strong>
          <span>
            {modules.reduce(
              (total, module) => total + (module.lessons?.length ?? 0),
              0,
            )}{" "}
            lessons
          </span>
        </div>

        <button
          type="button"
          className="instructor-secondary-button"
          onClick={() => {
            setLoading(true);
            setError("");
            loadCurriculum();
          }}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="instructor-empty">
          <p>Loading curriculum…</p>
        </div>
      ) : (
        <div className="instructor-studio-layout">
          <aside className="instructor-studio-modules">
            <div className="instructor-panel-heading">
              <div>
                <p className="instructor-eyebrow">STRUCTURE</p>
                <h3>Modules</h3>
              </div>

              {canEdit && (
                <button
                  type="button"
                  className="instructor-secondary-button"
                  onClick={() => {
                    resetModuleForm();
                    setModuleForm({
                      title: "",
                      description: "",
                      position: modules.length + 1,
                    });
                    setModuleFormOpen(true);
                    setNotice("");
                  }}
                >
                  + Add
                </button>
              )}
            </div>

            {modules.length === 0 ? (
              <div className="instructor-empty">
                <p>No modules yet. Create the first module to begin.</p>
              </div>
            ) : (
              <div className="instructor-studio-module-list">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    className={`instructor-studio-module ${
                      module.id === selectedModuleId ? "active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="instructor-studio-module-select"
                      onClick={() => selectModule(module)}
                    >
                      <span className="instructor-studio-module-number">
                        {module.position}
                      </span>
                      <span>
                        <strong>{module.title}</strong>
                        <small>{module.lessons?.length ?? 0} lessons</small>
                      </span>
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        className="instructor-studio-text-button"
                        onClick={() => startEditModule(module)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {moduleFormOpen && canEdit && (
              <form
                className="instructor-program-form instructor-studio-form"
                onSubmit={saveModule}
              >
                <h3>
                  {editingModuleId !== null ? "Edit module" : "New module"}
                </h3>

                <label>
                  Module title
                  <input
                    required
                    maxLength={191}
                    value={moduleForm.title}
                    onChange={(event) =>
                      setModuleForm({
                        ...moduleForm,
                        title: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Description
                  <textarea
                    rows={3}
                    value={moduleForm.description}
                    onChange={(event) =>
                      setModuleForm({
                        ...moduleForm,
                        description: event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Position
                  <input
                    type="number"
                    min="1"
                    required
                    value={moduleForm.position}
                    onChange={(event) =>
                      setModuleForm({
                        ...moduleForm,
                        position: event.target.value,
                      })
                    }
                  />
                </label>

                <div className="instructor-studio-actions">
                  <button
                    type="submit"
                    className="instructor-primary-button"
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save module"}
                  </button>
                  <button
                    type="button"
                    className="instructor-secondary-button"
                    onClick={resetModuleForm}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </aside>

          <div className="instructor-studio-lessons">
            {!selectedModule ? (
              <div className="instructor-empty">
                <span>▤</span>
                <h3>Your curriculum starts here</h3>
                <p>
                  Select a module or create one to start building your lessons.
                </p>
              </div>
            ) : (
              <>
                <div className="instructor-panel-heading">
                  <div>
                    <p className="instructor-eyebrow">
                      MODULE {selectedModule.position}
                    </p>
                    <h3>{selectedModule.title}</h3>
                    {selectedModule.description && (
                      <p className="instructor-muted">
                        {selectedModule.description}
                      </p>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      className="instructor-primary-button"
                      onClick={startNewLesson}
                    >
                      + Add lesson
                    </button>
                  )}
                </div>

                {lessons.length === 0 ? (
                  <div className="instructor-empty">
                    <h3>No lessons in this module</h3>
                    <p>
                      Break this module into practical, progressive learning
                      sessions.
                    </p>
                  </div>
                ) : (
                  <div className="instructor-studio-lesson-list">
                    {lessons.map((lesson) => (
                      <article
                        className={`instructor-studio-lesson ${
                          lesson.id === selectedLessonId ? "active" : ""
                        }`}
                        key={lesson.id}
                      >
                        <div>
                          <span className="instructor-eyebrow">
                            LESSON {lesson.position}
                          </span>
                          <h4>{lesson.title}</h4>
                          {lesson.description && <p>{lesson.description}</p>}
                          <small>{lesson.estimatedMinutes ?? 30} minutes</small>
                        </div>

                        <button
                          type="button"
                          className="instructor-secondary-button"
                          onClick={() => startEditLesson(lesson)}
                        >
                          {canEdit ? "Edit lesson" : "View lesson"}
                        </button>
                        <button
                          type="button"
                          className="instructor-secondary-button"
                          onClick={() => {
                            setSelectedLessonId(lesson.id);
                            setLessonFormOpen(false);
                            setLessonViewOpen(false);
                            setEditingLessonId(null);
                            setError("");
                            setNotice("");
                          }}
                        >
                          Resources & assessments
                        </button>
                      </article>
                    ))}
                  </div>
                )}
                {selectedLessonId && !lessonFormOpen && !lessonViewOpen && (
                  <InstructorLearningContent
                    key={selectedLessonId}
                    lessonId={selectedLessonId}
                    canEdit={canEdit}
                  />
                )}

                {lessonViewOpen && !canEdit && (
                  <article className="instructor-program-form instructor-studio-form">
                    <div className="instructor-panel-heading">
                      <div>
                        <p className="instructor-eyebrow">LESSON DETAILS</p>
                        <h3>{lessonForm.title || "Untitled lesson"}</h3>
                      </div>

                      <button
                        type="button"
                        className="instructor-secondary-button"
                        onClick={() => setLessonViewOpen(false)}
                      >
                        Close
                      </button>
                    </div>

                    <p className="instructor-muted">
                      {lessonForm.estimatedMinutes} minutes
                    </p>

                    {lessonForm.description && (
                      <section>
                        <h4>Description</h4>
                        <p>{lessonForm.description}</p>
                      </section>
                    )}

                    {lessonForm.objectives && (
                      <section>
                        <h4>Learning objectives</h4>
                        <p className="instructor-preserved-content">
                          {lessonForm.objectives}
                        </p>
                      </section>
                    )}

                    {lessonForm.preparationContent && (
                      <section>
                        <h4>Preparation</h4>
                        <p className="instructor-preserved-content">
                          {lessonForm.preparationContent}
                        </p>
                      </section>
                    )}

                    {lessonForm.content ? (
                      <section>
                        <h4>Lesson content</h4>
                        <div className="instructor-preserved-content">
                          {lessonForm.content}
                        </div>
                      </section>
                    ) : (
                      <p className="instructor-muted">
                        No lesson content has been added yet.
                      </p>
                    )}
                  </article>
                )}

                {lessonFormOpen && canEdit && (
                  <form
                    className="instructor-program-form instructor-studio-form"
                    onSubmit={saveLesson}
                  >
                    <h3>
                      {editingLessonId !== null ? "Edit lesson" : "New lesson"}
                    </h3>

                    <label>
                      Lesson title
                      <input
                        required
                        maxLength={191}
                        value={lessonForm.title}
                        onChange={(event) =>
                          setLessonForm({
                            ...lessonForm,
                            title: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Short description
                      <textarea
                        rows={2}
                        value={lessonForm.description}
                        onChange={(event) =>
                          setLessonForm({
                            ...lessonForm,
                            description: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Learning objectives
                      <textarea
                        rows={3}
                        value={lessonForm.objectives}
                        onChange={(event) =>
                          setLessonForm({
                            ...lessonForm,
                            objectives: event.target.value,
                          })
                        }
                        placeholder="What should learners be able to do after this lesson?"
                      />
                    </label>

                    <label>
                      Preparation content
                      <textarea
                        rows={4}
                        value={lessonForm.preparationContent}
                        onChange={(event) =>
                          setLessonForm({
                            ...lessonForm,
                            preparationContent: event.target.value,
                          })
                        }
                        placeholder="What should learners read, watch or prepare beforehand?"
                      />
                    </label>

                    <label>
                      Lesson content
                      <textarea
                        rows={10}
                        value={lessonForm.content}
                        onChange={(event) =>
                          setLessonForm({
                            ...lessonForm,
                            content: event.target.value,
                          })
                        }
                        placeholder="Write the lesson instructions, explanations, activities and exercises."
                      />
                    </label>

                    <div className="instructor-form-grid">
                      <label>
                        Estimated duration (minutes)
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          required
                          value={lessonForm.estimatedMinutes}
                          onChange={(event) =>
                            setLessonForm({
                              ...lessonForm,
                              estimatedMinutes: event.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        Lesson position
                        <input
                          type="number"
                          min="1"
                          required
                          value={lessonForm.position}
                          onChange={(event) =>
                            setLessonForm({
                              ...lessonForm,
                              position: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="instructor-studio-actions">
                      <button
                        type="submit"
                        className="instructor-primary-button"
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save lesson"}
                      </button>
                      <button
                        type="button"
                        className="instructor-secondary-button"
                        onClick={resetLessonForm}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
