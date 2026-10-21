import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/$/, "");

const formatPrice = (amount) => {
  if (amount == null) return "Contact us for tuition";

  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount)} XAF`;
};

const formatDate = (value) => {
  if (!value) return "Date to be announced";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date to be announced";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Douala",
  }).format(date);
};

function Brand({ light = false }) {
  return (
    <a
      className={`brand${light ? " brand-light" : ""}`}
      href="#home"
      aria-label="Solyce home"
    >
      <span className="brand-mark" aria-hidden="true">
        S
      </span>
      <span className="brand-name">
        solyce<span>.</span>
      </span>
    </a>
  );
}

function ArrowIcon({ diagonal = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="arrow-icon"
    >
      {diagonal ? (
        <path
          d="M7 17 17 7M7 7h10v10"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M4 12h15m-6-6 6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function CourseCard({ course, onSelect }) {
  const languageLabel =
    course.language === "FRENCH" ? "French language" : "English language";

  return (
    <article className="course-card">
      <div className="course-card-top">
        <span className="course-category">{course.examType}</span>
        <span className="course-language">{languageLabel}</span>
      </div>

      <div className="course-card-body">
        <h3>{course.title}</h3>
        <p className="course-description">{course.description}</p>

        <div className="course-meta">
          <span>
            <span className="meta-dot" />
            {course.durationWeeks} weeks
          </span>
          <span>{formatPrice(course.priceXaf)}</span>
        </div>
      </div>

      <button
        className="course-card-link"
        type="button"
        onClick={() => onSelect(course)}
      >
        Explore program <ArrowIcon />
      </button>
    </article>
  );
}

function BookingForm({ course, cohort, onClose }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState(null);

  const price = cohort.priceXaf ?? course.priceXaf;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId: cohort.id,
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result?.error?.message ||
            result?.message ||
            "We could not complete your booking. Please try again.",
        );
      }

      setBooking(result.data || result);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Unable to reach Solyce. Please check your connection."
          : err.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (booking) {
    const reference =
      booking.reference || booking.bookingReference || booking.enrollment?.id;

    return (
      <div className="booking-panel" role="status">
        <p className="booking-eyebrow">BOOKING RECEIVED</p>
        <h3>Your next chapter starts here.</h3>
        <p>
          Your booking request has been recorded. It is not yet a confirmed
          enrolment. Confirmation follows verification of your full payment by
          the Solyce team.
        </p>

        {reference != null && (
          <div className="booking-reference">
            <span>Booking reference</span>
            <strong>
              {String(reference).startsWith("SOL-")
                ? reference
                : `SOL-${String(reference).padStart(6, "0")}`}
            </strong>
          </div>
        )}

        <p>
          Please keep your reference and contact the Solyce team for
          instructions on paying by MTN Mobile Money, Orange Money, bank
          transfer or another accepted offline method.
        </p>

        <button className="button button-primary" onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="booking-panel" onSubmit={handleSubmit}>
      <p className="booking-eyebrow">RESERVE YOUR PLACE</p>
      <h3>Book your place in {cohort.name}</h3>
      <p>
        Enter your contact details to reserve a place. No student account is
        required.
      </p>

      <div className="booking-summary">
        <span>{course.title}</span>
        <strong>{formatPrice(price)}</strong>
      </div>

      <label className="booking-field">
        <span>Full name</span>
        <input
          autoComplete="name"
          required
          maxLength={150}
          value={form.fullName}
          onChange={(event) =>
            setForm({ ...form, fullName: event.target.value })
          }
          placeholder="Your full name"
        />
      </label>

      <label className="booking-field">
        <span>Email address</span>
        <input
          type="email"
          autoComplete="email"
          required
          maxLength={191}
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="you@example.com"
        />
      </label>

      <label className="booking-field">
        <span>Phone number</span>
        <input
          type="tel"
          autoComplete="tel"
          required
          maxLength={40}
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="+237 ..."
        />
      </label>

      {error && (
        <p className="booking-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="button button-primary booking-submit"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Submittingâ€¦" : "Submit booking"}
        {!submitting && <ArrowIcon />}
      </button>

      <p className="booking-disclaimer">
        Your place is not confirmed until the required payment has been verified
        by Solyce.
      </p>
    </form>
  );
}

function CourseDetail({ course, onBack }) {
  const curriculum = (course.curriculum || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const [bookingCohort, setBookingCohort] = useState(null);

  return (
    <main className="detail-page">
      <div className="container">
        <button className="back-link" type="button" onClick={onBack}>
          <span aria-hidden="true">â†</span> Back to programs
        </button>

        <section className="detail-hero">
          <div className="detail-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              {course.examType} preparation
            </div>

            <span className="detail-language">
              {course.language === "FRENCH" ? "French" : "English"} language
            </span>

            <h1>{course.title}</h1>
            <p className="detail-description">{course.description}</p>

            <div className="detail-facts">
              <div>
                <span className="fact-label">Duration</span>
                <strong>{course.durationWeeks} weeks</strong>
              </div>
              <div>
                <span className="fact-label">Tuition</span>
                <strong>{formatPrice(course.priceXaf)}</strong>
              </div>
            </div>

            <a className="button button-primary" href="#course-schedule">
              Explore availability <ArrowIcon />
            </a>
          </div>

          <div className="detail-art" aria-hidden="true">
            <div className="detail-art-circle" />
            <span className="detail-art-letter">
              {course.examType?.slice(0, 1) || "S"}
            </span>
            <span className="detail-art-caption">LEARN WITH PURPOSE</span>
          </div>
        </section>

        <section className="curriculum-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Your learning journey
              </div>
              <h2>A program with a clear direction.</h2>
            </div>
            <p>
              A structured progression designed to build skills, confidence, and
              exam readiness.
            </p>
          </div>

          {curriculum.length > 0 ? (
            <ol className="curriculum-list">
              {curriculum.map((item, index) => (
                <li key={`${index}-${item}`}>
                  <span className="curriculum-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{item}</span>
                  <span className="curriculum-check" aria-hidden="true">
                    â†—
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-inline">
              Detailed curriculum information will be available soon.
            </div>
          )}
        </section>

        <section id="course-schedule" className="schedule-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Next steps
              </div>
              <h2>Find your next cohort.</h2>
            </div>
          </div>

          {course.cohorts?.length ? (
            <div className="cohort-list">
              {course.cohorts.map((cohort) => (
                <article className="cohort-card" key={cohort.id}>
                  <div>
                    <span className="cohort-label">{cohort.name}</span>
                    <h3>{formatDate(cohort.startDate)}</h3>
                    <p>
                      Ends {formatDate(cohort.endDate)} Â·{" "}
                      {cohort.scheduleDescription}
                    </p>
                  </div>
                  <div className="cohort-price">
                    <strong>
                      {formatPrice(cohort.priceXaf ?? course.priceXaf)}
                    </strong>
                    <span>{cohort.seatsRemaining} places remaining</span>
                    <button
                      className="button button-primary cohort-book-button"
                      type="button"
                      onClick={() => setBookingCohort(cohort)}
                    >
                      Reserve your place <ArrowIcon />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="availability-panel">
              <div className="availability-icon" aria-hidden="true">
                â†—
              </div>
              <div>
                <h3>Upcoming dates are being prepared.</h3>
                <p>
                  Contact our team to express your interest and learn when the
                  next intake will open.
                </p>
              </div>
              <a
                className="button button-outline"
                href="mailto:hello@solyce.com?subject=Course%20enquiry"
              >
                Contact the team <ArrowIcon diagonal />
              </a>
            </div>
          )}
        </section>
        {bookingCohort && (
          <section
            className="booking-section"
            id="course-booking"
            aria-label="Course booking"
          >
            <BookingForm
              course={course}
              cohort={bookingCohort}
              onClose={() => setBookingCohort(null)}
            />
          </section>
        )}
      </div>
    </main>
  );
}

function App() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("ALL");
  const [selectedCourse, setSelectedCourse] = useState(null);

  async function loadCourses(signal) {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/courses`, { signal });

      if (!response.ok) {
        throw new Error(
          `The catalogue could not be loaded (HTTP ${response.status}).`,
        );
      }

      const result = await response.json();

      if (!Array.isArray(result.data)) {
        throw new Error("The catalogue returned an unexpected response.");
      }

      setCourses(result.data);
    } catch (err) {
      if (err.name === "AbortError") return;

      setError(
        err instanceof TypeError
          ? "We couldn't reach the Solyce server. Check your connection and try again."
          : err.message || "Something went wrong while loading programs.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    loadCourses(controller.signal);

    return () => controller.abort();
  }, []);

  const filteredCourses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return courses.filter((course) => {
      const matchesLanguage =
        language === "ALL" || course.language === language;

      const searchableText = [
        course.title,
        course.description,
        course.examType,
        course.language,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesLanguage &&
        (!normalizedSearch || searchableText.includes(normalizedSearch))
      );
    });
  }, [courses, search, language]);

  function selectCourse(course) {
    setSelectedCourse(course);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showCatalogue() {
    setSelectedCourse(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="site-shell" id="home">
      <div className="announcement-bar">
        <span className="announcement-dot" />A new standard for language
        learning
        <span className="announcement-divider">/</span>
        Built for your next chapter
      </div>

      <header className="site-header">
        <div className="container nav-container">
          <Brand />

          <nav className="main-nav" aria-label="Main navigation">
            <a href="#programs" onClick={showCatalogue}>
              Programs
            </a>
            <a href="#approach" onClick={showCatalogue}>
              Our approach
            </a>
            <a href="#about" onClick={showCatalogue}>
              About Solyce
            </a>
          </nav>

          <a
            className="button button-dark nav-cta"
            href="mailto:hello@solyce.com?subject=Solyce%20enquiry"
          >
            Talk to our team <ArrowIcon diagonal />
          </a>
        </div>
      </header>

      {selectedCourse ? (
        <CourseDetail course={selectedCourse} onBack={showCatalogue} />
      ) : (
        <main>
          <section className="hero-section">
            <div className="hero-grid-pattern" aria-hidden="true" />
            <div className="container hero-layout">
              <div className="hero-copy">
                <div className="eyebrow hero-eyebrow">
                  <span className="eyebrow-line" />
                  Your ambition deserves a plan
                </div>

                <h1>
                  Speak with
                  <br />
                  <span>purpose.</span>
                  <br />
                  Move with
                  <br />
                  confidence.
                </h1>

                <p className="hero-description">
                  Language skills open doors. Solyce helps you prepare with
                  structure, expert guidance, and a clear path toward your
                  goals.
                </p>

                <div className="hero-actions">
                  <a className="button button-primary" href="#programs">
                    Discover our programs <ArrowIcon />
                  </a>
                  <a className="text-link" href="#approach">
                    The Solyce approach <span>â†“</span>
                  </a>
                </div>

                <div className="hero-footnote">
                  <span className="footnote-mark">âœ³</span>
                  <span>Purposeful learning. Meaningful progress.</span>
                </div>
              </div>

              <div
                className="hero-visual"
                aria-label="Solyce learning philosophy"
              >
                <img
                  className="hero-photo"
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80"
                  alt=""
                  loading="eager"
                  fetchPriority="high"
                />
                <div className="visual-topline">
                  <span>THE SOLYCE METHOD</span>
                  <span>01 â€” 03</span>
                </div>

                <div className="visual-composition">
                  <div className="visual-orbit orbit-one" />
                  <div className="visual-orbit orbit-two" />
                  <div className="visual-disc">
                    <span className="disc-letter">S</span>
                    <span className="disc-small">SOLYCE</span>
                  </div>
                  <div className="visual-label label-top">
                    <span className="label-index">01</span>
                    <span>Clarity</span>
                  </div>
                  <div className="visual-label label-right">
                    <span className="label-index">02</span>
                    <span>Practice</span>
                  </div>
                  <div className="visual-label label-bottom">
                    <span className="label-index">03</span>
                    <span>Progress</span>
                  </div>
                  <span className="visual-cross cross-one">+</span>
                  <span className="visual-cross cross-two">+</span>
                </div>

                <div className="visual-bottomline">
                  <span>Learn deliberately.</span>
                  <span className="visual-bottom-mark">S.</span>
                </div>
              </div>
            </div>

            <div className="hero-bottom container">
              <span>EDUCATION, WITH INTENTION.</span>
              <a href="#programs">
                Explore the catalogue <span>â†“</span>
              </a>
            </div>
          </section>

          <section className="principles-section" id="approach">
            <div className="container principles-layout">
              <div className="principles-intro">
                <span className="section-kicker">THE SOLYCE DIFFERENCE</span>
                <h2>
                  Not just more learning.
                  <br />
                  <span>More intentional learning.</span>
                </h2>
              </div>

              <div className="principles-grid">
                <article className="principle">
                  <span className="principle-number">01 / CLARITY</span>
                  <h3>Know your direction.</h3>
                  <p>
                    Start with a clear objective and a learning path designed
                    around what you want to achieve.
                  </p>
                </article>
                <article className="principle">
                  <span className="principle-number">02 / PRACTICE</span>
                  <h3>Build through doing.</h3>
                  <p>
                    Turn knowledge into usable skills through deliberate
                    practice and structured progression.
                  </p>
                </article>
                <article className="principle">
                  <span className="principle-number">03 / PROGRESS</span>
                  <h3>See the difference.</h3>
                  <p>
                    Develop confidence through meaningful milestones and focused
                    preparation.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section className="catalogue-section" id="programs">
            <div className="container">
              <div className="catalogue-heading">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    The learning catalogue
                  </div>
                  <h2>Choose your next chapter.</h2>
                  <p className="section-description">
                    Explore structured programs designed around your language
                    goals and the next opportunity you want to pursue.
                  </p>
                </div>

                <div className="catalogue-aside">
                  <span className="catalogue-aside-mark">S.</span>
                  <span>
                    Find the program
                    <br />
                    that moves you forward.
                  </span>
                </div>
              </div>

              <div className="catalogue-controls">
                <div className="filter-tabs" aria-label="Filter by language">
                  {[
                    { value: "ALL", label: "All programs" },
                    { value: "FRENCH", label: "French" },
                    { value: "ENGLISH", label: "English" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`filter-tab${language === item.value ? " active" : ""}`}
                      aria-pressed={language === item.value}
                      onClick={() => setLanguage(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="search-field">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <circle
                      cx="10.8"
                      cy="10.8"
                      r="6.8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="m16 16 4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    type="search"
                    placeholder="Search programs"
                    aria-label="Search programs"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>

              {loading ? (
                <div className="catalogue-status" role="status">
                  <span className="loading-spinner" />
                  <p>Preparing your catalogueâ€¦</p>
                </div>
              ) : error ? (
                <div className="catalogue-status status-error" role="alert">
                  <span className="status-symbol">!</span>
                  <h3>We couldn't load the programs.</h3>
                  <p>{error}</p>
                  <button
                    className="button button-dark"
                    type="button"
                    onClick={() => {
                      const controller = new AbortController();
                      loadCourses(controller.signal);
                    }}
                  >
                    Try again <ArrowIcon />
                  </button>
                </div>
              ) : filteredCourses.length > 0 ? (
                <>
                  <div className="results-caption">
                    <span>
                      {filteredCourses.length}{" "}
                      {filteredCourses.length === 1 ? "program" : "programs"}
                    </span>
                    <span>Designed with intention</span>
                  </div>

                  <div className="course-grid">
                    {filteredCourses.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        onSelect={selectCourse}
                      />
                    ))}
                  </div>
                </>
              ) : courses.length > 0 ? (
                <div className="catalogue-status">
                  <span className="status-symbol">âŒ•</span>
                  <h3>No matching programs.</h3>
                  <p>Try another search or select a different language.</p>
                  <button
                    className="text-link reset-link"
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setLanguage("ALL");
                    }}
                  >
                    Clear filters <ArrowIcon />
                  </button>
                </div>
              ) : (
                <div className="catalogue-empty">
                  <div className="empty-monogram">
                    S<span>.</span>
                  </div>
                  <div className="empty-copy">
                    <span className="section-kicker">
                      A NEW CHAPTER BEGINS SOON
                    </span>
                    <h3>We're preparing something meaningful.</h3>
                    <p>
                      Our first learning programs are being prepared. Get in
                      touch with our team to share your goals and hear when
                      enrolment opens.
                    </p>
                    <a
                      className="button button-dark"
                      href="mailto:hello@solyce.com?subject=Upcoming%20Solyce%20programs"
                    >
                      Express your interest <ArrowIcon diagonal />
                    </a>
                  </div>
                  <div className="empty-index">
                    COMING
                    <br />
                    INTO FOCUS / 01
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="closing-section" id="about">
            <div className="container closing-layout">
              <div>
                <span className="section-kicker">
                  YOUR NEXT CHAPTER STARTS HERE
                </span>
                <h2>
                  Give your ambition
                  <br />
                  <span>a clear direction.</span>
                </h2>
              </div>
              <div className="closing-action">
                <p>
                  Tell us what you want to achieve. Let's explore the right
                  learning path for you.
                </p>
                <a
                  className="button button-light"
                  href="mailto:hello@solyce.com?subject=Let's%20talk%20about%20Solyce"
                >
                  Start a conversation <ArrowIcon diagonal />
                </a>
              </div>
              <span className="closing-watermark" aria-hidden="true">
                S.
              </span>
            </div>
          </section>
        </main>
      )}

      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <Brand light />
            <p>
              Purposeful learning.
              <br />
              Meaningful progress.
            </p>
          </div>

          <div className="footer-column">
            <span className="footer-heading">EXPLORE</span>
            <a href="#programs" onClick={showCatalogue}>
              Programs
            </a>
            <a href="#approach" onClick={showCatalogue}>
              Our approach
            </a>
            <a href="#about" onClick={showCatalogue}>
              About Solyce
            </a>
          </div>

          <div className="footer-column">
            <span className="footer-heading">GET IN TOUCH</span>
            <a href="mailto:hello@solyce.com">hello@solyce.com</a>
            <span>Cameroon</span>
          </div>

          <div className="footer-note">
            <span className="footer-note-mark">âœ³</span>
            <p>
              Every next chapter
              <br />
              begins with intention.
            </p>
          </div>
        </div>

        <div className="container footer-bottom">
          <span>Â© {new Date().getFullYear()} Solyce. All rights reserved.</span>
          <span>Built around your next chapter.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

