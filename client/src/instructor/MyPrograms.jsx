import { useCallback, useEffect, useState } from "react";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}/api/instructor/programs${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const body =
    response.status === 204 ? null : await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.error?.message || "The request failed.");
  }

  return body?.data;
}

const emptyForm = {
  slug: "",
  title: "",
  description: "",
  language: "ENGLISH",
  examType: "",
  durationWeeks: 12,
  curriculum: "",
  priceXaf: 0,
};

function statusLabel(status) {
  return (status || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export default function MyPrograms({ onManageCurriculum }) {
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await request("");
      setPrograms(result?.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(loadPrograms, 0);
    return () => clearTimeout(timeoutId);
  }, [loadPrograms]);

  function startCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
    setNotice("");
  }

  async function startEdit(id) {
    setError("");
    setNotice("");

    try {
      const result = await request(`/${id}`);
      const program = result;

      setForm({
        slug: program.slug || "",
        title: program.title || "",
        description: program.description || "",
        language: program.language || "ENGLISH",
        examType: program.examType || "",
        durationWeeks: program.durationWeeks || 12,
        curriculum: program.curriculum || "",
        priceXaf: program.priceXaf ?? 0,
      });

      setEditingId(id);
      setShowForm(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "durationWeeks" || name === "priceXaf" ? Number(value) : value,
    }));
  }

  async function saveProgram(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        ...form,
        curriculum: form.curriculum.trim() || null,
      };

      const result = await request(editingId ? `/${editingId}` : "", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setEditingId(null);
      setNotice(`“${result.title}” saved as a draft.`);
      await loadPrograms();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview(program) {
    const confirmed = window.confirm(
      `Submit "${program.title}" to the administrator for review? You will not be able to edit it while it is under review.`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      await request(`/${program.id}/submit`, { method: "POST" });
      setNotice(`“${program.title}” has been submitted for review.`);
      await loadPrograms();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="instructor-programs">
      <header className="instructor-programs-header">
        <div>
          <p className="instructor-eyebrow">PROGRAM MANAGEMENT</p>
          <h1>My programs</h1>
          <p className="instructor-programs-intro">
            Design your courses, prepare their curriculum, and submit them for
            administrator approval before publication.
          </p>
        </div>

        {!showForm && (
          <button
            className="instructor-primary-button instructor-create-button"
            onClick={startCreate}
          >
            + Create a program
          </button>
        )}
      </header>

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

      {showForm && (
        <form className="instructor-program-form" onSubmit={saveProgram}>
          <div className="instructor-program-form-heading">
            <div>
              <p className="instructor-eyebrow">
                {editingId ? "EDIT PROGRAM" : "NEW PROGRAM"}
              </p>
              <h2>{editingId ? "Update your draft" : "Program details"}</h2>
            </div>
            <button
              type="button"
              className="instructor-secondary-button"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>

          <div className="instructor-form-grid">
            <label>
              Program title *
              <input
                name="title"
                required
                minLength={3}
                maxLength={191}
                value={form.title}
                onChange={updateField}
                placeholder="e.g. TCF Preparation Program"
              />
            </label>

            <label>
              URL slug *
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={191}
                value={form.slug}
                onChange={updateField}
                placeholder="tcf-preparation"
              />
              <small>Lowercase letters, numbers and hyphens only.</small>
            </label>

            <label>
              Teaching language *
              <select
                name="language"
                value={form.language}
                onChange={updateField}
              >
                <option value="ENGLISH">English</option>
                <option value="FRENCH">French</option>
              </select>
            </label>

            <label>
              Exam or program category *
              <input
                name="examType"
                required
                maxLength={50}
                value={form.examType}
                onChange={updateField}
                placeholder="e.g. TCF, DELF, General French"
              />
            </label>

            <label>
              Duration (weeks) *
              <input
                name="durationWeeks"
                type="number"
                required
                min={1}
                max={104}
                value={form.durationWeeks}
                onChange={updateField}
              />
            </label>

            <label>
              Price (XAF) *
              <input
                name="priceXaf"
                type="number"
                required
                min={0}
                max={100000000}
                value={form.priceXaf}
                onChange={updateField}
              />
            </label>

            <label className="instructor-form-full">
              Program description *
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={20000}
                rows={5}
                value={form.description}
                onChange={updateField}
                placeholder="Describe the target learners, learning outcomes and teaching approach."
              />
            </label>

            <label className="instructor-form-full">
              Curriculum overview
              <textarea
                name="curriculum"
                maxLength={30000}
                rows={5}
                value={form.curriculum}
                onChange={updateField}
                placeholder="Outline the modules and progression of the program."
              />
            </label>
          </div>

          <div className="instructor-form-actions">
            <button
              type="button"
              className="instructor-secondary-button"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="instructor-primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save as draft"}
            </button>
          </div>
        </form>
      )}

      <div className="instructor-programs-summary">
        <div>
          <h2>Your course catalogue</h2>
          <p>
            {programs.length} program{programs.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          className="instructor-secondary-button"
          onClick={loadPrograms}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="instructor-programs-empty">Loading your programs…</div>
      ) : programs.length === 0 ? (
        <div className="instructor-programs-empty">
          <span className="instructor-programs-empty-icon">＋</span>
          <h3>Your first program starts here.</h3>
          <p>
            Create a program, define its learning outcomes, and save it as a
            draft. You can submit it for review when the details are ready.
          </p>
          {!showForm && (
            <button className="instructor-primary-button" onClick={startCreate}>
              Create your first program
            </button>
          )}
        </div>
      ) : (
        <div className="instructor-program-grid">
          {programs.map((program) => {
            const editable = ["DRAFT", "REJECTED"].includes(
              program.approvalStatus,
            );

            return (
              <article className="instructor-program-card" key={program.id}>
                <div className="instructor-program-card-top">
                  <span className="instructor-program-language">
                    {program.language === "FRENCH" ? "French" : "English"}
                  </span>
                  <span
                    className={`instructor-status program-status-${program.approvalStatus.toLowerCase()}`}
                  >
                    {statusLabel(program.approvalStatus)}
                  </span>
                </div>

                <h3>{program.title}</h3>
                <p className="instructor-program-category">
                  {program.examType}
                </p>

                <div className="instructor-program-metadata">
                  <span>{program.durationWeeks} weeks</span>
                  <span>
                    {Number(program.priceXaf).toLocaleString("en")} XAF
                  </span>
                </div>

                <div className="instructor-program-card-bottom">
                  <span>{program._count?.modules || 0} modules</span>

                  <div>
                    <button
                      type="button"
                      className="instructor-text-button"
                      onClick={() => onManageCurriculum?.(program)}
                    >
                      Manage curriculum →
                    </button>

                    {editable && (
                      <button
                        type="button"
                        className="instructor-text-button"
                        onClick={() => startEdit(program.id)}
                      >
                        Edit
                      </button>
                    )}

                    {editable && (
                      <button
                        type="button"
                        className="instructor-text-button"
                        onClick={() => submitForReview(program)}
                      >
                        Submit for review →
                      </button>
                    )}
                  </div>
                </div>

                {program.approvalStatus === "PENDING_REVIEW" && (
                  <p className="instructor-program-footnote">
                    Awaiting administrator review. Editing is temporarily
                    locked.
                  </p>
                )}
                {program.approvalStatus === "REJECTED" && (
                  <p className="instructor-program-footnote">
                    This program was returned for changes. Update it and
                    resubmit.
                  </p>
                )}
                {program.approvalStatus === "APPROVED" && (
                  <p className="instructor-program-footnote">
                    Approved by the administrator. Publication is managed by the
                    administrator.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
