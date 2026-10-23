import { useEffect, useMemo, useRef, useState } from "react";
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
  const isFrench = course.language === "FRENCH";

  const languageLabel = isFrench ? "French" : "English";
  const courseImage = isFrench
    ? "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80"
    : "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=900&q=80";

  const imageAlt = isFrench
    ? "Learner studying with books and notes"
    : "Students learning together in a classroom";

  return (
    <article className="course-card">
      <div className="course-card-image-wrap">
        <img
          className="course-card-image"
          src={courseImage}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
        />

        <span className="course-card-image-label">
          {languageLabel} learning
        </span>

        <span className="course-card-image-index" aria-hidden="true">
          S.
        </span>
      </div>

      <div className="course-card-content">
        <div className="course-card-top">
          <span className="course-category">
            {course.examType || "Language program"}
          </span>
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
          aria-label={`Explore ${course.title}`}
        >
          <span>Explore program</span>
          <ArrowIcon />
        </button>
      </div>
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
      <div
        className="booking-panel booking-success"
        role="status"
        aria-live="polite"
      >
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
        <div className="booking-error" role="alert" aria-live="assertive">
          <strong>Booking unsuccessful</strong>
          <p>{error}</p>
        </div>
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

  const modules = course.modules || [];

  function splitContent(value) {
    return (value || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const [bookingCohort, setBookingCohort] = useState(null);
  const bookingSectionRef = useRef(null);

  const languageLabel = course.language === "FRENCH" ? "French" : "English";

  const heroImage =
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=85";

  useEffect(() => {
    if (!bookingCohort || !bookingSectionRef.current) return;

    const section = bookingSectionRef.current;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    section.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });

    section.focus({ preventScroll: true });
  }, [bookingCohort]);

  return (
    <main className="detail-page">
      <div className="container">
        <button className="back-link" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Back to programs
        </button>

        {/* 01 — Hero éditorial */}
        <section className="detail-hero">
          <div className="detail-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              Your next chapter starts here
            </div>

            <div className="detail-labels">
              <span className="detail-language">{languageLabel}</span>
              {course.examType && (
                <span className="detail-program-type">
                  {course.examType} preparation
                </span>
              )}
            </div>

            <h1>{course.title}</h1>

            <p className="detail-description">{course.description}</p>

            <div className="detail-facts">
              <div>
                <span className="fact-label">Program duration</span>
                <strong>{course.durationWeeks} weeks</strong>
              </div>

              <div>
                <span className="fact-label">Program tuition</span>
                <strong>{formatPrice(course.priceXaf)}</strong>
              </div>
            </div>

            <a className="button button-primary" href="#course-schedule">
              Explore available sessions <ArrowIcon />
            </a>

            <p className="detail-hero-note">
              Structured learning. Live guidance. A clear next step.
            </p>
          </div>

          <div className="detail-visual">
            <img
              className="detail-hero-image"
              src={heroImage}
              alt="Students learning together in a collaborative environment"
              loading="eager"
              fetchPriority="high"
            />

            <div className="detail-visual-overlay" />

            <div className="detail-visual-topline">
              <span>THE SOLYCE EXPERIENCE</span>
              <span>01 / YOUR JOURNEY</span>
            </div>

            <div className="detail-visual-caption">
              <span className="detail-caption-mark">S.</span>
              <div>
                <strong>Learn with purpose.</strong>
                <span>Move forward with confidence.</span>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — Curriculum détaillé */}
        <section
          className="curriculum-section detail-curriculum"
          aria-labelledby="curriculum-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Your learning journey
              </div>
              <h2 id="curriculum-title">
                A clear path from learning to practice.
              </h2>
            </div>
            <p>
              Explore the modules, lessons and learning objectives that
              structure your progress throughout this program.
            </p>
          </div>

          {modules.length > 0 ? (
            <div className="detail-module-list">
              {modules.map((module, index) => (
                <details
                  className="detail-module"
                  key={module.id}
                  open={index === 0}
                >
                  <summary className="detail-module-summary">
                    <span className="curriculum-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="detail-module-heading">
                      <strong>{module.title}</strong>
                      <span>
                        {module.lessons?.length || 0} lesson
                        {module.lessons?.length === 1 ? "" : "s"}
                      </span>
                    </span>

                    <span className="detail-module-toggle" aria-hidden="true">
                      +
                    </span>
                  </summary>

                  {module.description && (
                    <p className="detail-module-description">
                      {module.description}
                    </p>
                  )}

                  {module.lessons?.length > 0 ? (
                    <ol className="detail-lesson-list">
                      {module.lessons.map((lesson, lessonIndex) => (
                        <li className="detail-lesson" key={lesson.id}>
                          <span className="detail-lesson-index">
                            {String(lessonIndex + 1).padStart(2, "0")}
                          </span>

                          <div className="detail-lesson-content">
                            <h3>{lesson.title}</h3>

                            {lesson.description && <p>{lesson.description}</p>}

                            {lesson.objectives && (
                              <div className="detail-lesson-objectives">
                                <strong>Learning objectives</strong>
                                <p>{lesson.objectives}</p>
                              </div>
                            )}
                          </div>

                          {lesson.estimatedMinutes != null && (
                            <span className="detail-lesson-duration">
                              {lesson.estimatedMinutes} min
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="empty-inline">
                      Lessons for this module will be published soon.
                    </p>
                  )}
                </details>
              ))}
            </div>
          ) : curriculum.length > 0 ? (
            <ol className="curriculum-list">
              {curriculum.map((item, index) => (
                <li key={`${index}-${item}`}>
                  <span className="curriculum-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="curriculum-item-text">{item}</span>
                  <span className="curriculum-arrow" aria-hidden="true">
                    ↗
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-inline">
              The detailed curriculum will be available soon.
            </div>
          )}
        </section>

        {/* 02B — Ce que le programme apporte */}
        {[
          {
            id: "audience",
            number: "01",
            eyebrow: "IS THIS PROGRAM FOR YOU?",
            title: "Who this program is for",
            description:
              "Understand whether this learning path matches your goals and current level.",
            items: splitContent(course.targetAudience),
          },
          {
            id: "prerequisites",
            number: "02",
            eyebrow: "BEFORE YOU BEGIN",
            title: "What you need to get started",
            description:
              "Review the recommended background and requirements before enrolling.",
            items: splitContent(course.prerequisites),
          },
          {
            id: "outcomes",
            number: "03",
            eyebrow: "YOUR PROGRESS",
            title: "What you will learn",
            description:
              "Explore the knowledge and skills this program is designed to develop.",
            items: splitContent(course.learningOutcomes),
          },
          {
            id: "benefits",
            number: "04",
            eyebrow: "THE VALUE OF LEARNING",
            title: "What makes this program valuable",
            description:
              "Discover how the program supports your learning objectives.",
            items: splitContent(course.courseBenefits),
          },
          {
            id: "solyce",
            number: "05",
            eyebrow: "THE SOLYCE DIFFERENCE",
            title: "Why learn with Solyce?",
            description:
              "See how our learning experience supports your progress.",
            items: splitContent(course.solyceAdvantages),
          },
          {
            id: "projects",
            number: "06",
            eyebrow: "LEARNING BY DOING",
            title: "Put your knowledge into practice",
            description:
              "Explore the practical exercises and projects included in the program.",
            items: splitContent(course.practicalProjects),
          },
          {
            id: "certifications",
            number: "07",
            eyebrow: "RECOGNITION & EXAMS",
            title: "Certifications and exam pathways",
            description:
              "Review the certifications or examinations explicitly associated with this program.",
            items: splitContent(course.certifications),
          },
          {
            id: "careers",
            number: "08",
            eyebrow: "LOOKING AHEAD",
            title: "Where this learning can take you",
            description:
              "Explore the opportunities and next steps relevant to your learning goals.",
            items: splitContent(course.careerOutcomes),
          },
        ]
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <section
              className="detail-marketing-section"
              key={section.id}
              aria-labelledby={`detail-${section.id}-title`}
            >
              <div className="detail-marketing-index">
                <span>{section.number}</span>
                <span className="detail-marketing-index-line" />
              </div>

              <div className="detail-marketing-content">
                <div className="eyebrow">
                  <span className="eyebrow-line" />
                  {section.eyebrow}
                </div>

                <h2 id={`detail-${section.id}-title`}>{section.title}</h2>
                <p className="detail-marketing-description">
                  {section.description}
                </p>

                <ul className="detail-marketing-list">
                  {section.items.map((item, index) => (
                    <li key={`${section.id}-${index}`}>
                      <span
                        className="detail-marketing-check"
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}

        {/* 03 — L'expérience d'apprentissage */}
        <section
          className="detail-experience"
          aria-labelledby="experience-title"
        >
          <div className="detail-experience-intro">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              The Solyce approach
            </div>

            <h2 id="experience-title">
              Learning works better when you take part.
            </h2>

            <p>
              Solyce brings learners together for instructor-led live classes,
              with opportunities to practise, ask questions and work toward a
              shared learning objective.
            </p>
          </div>

          <div className="detail-experience-points">
            <article className="detail-experience-point">
              <span className="detail-point-number">01</span>
              <div>
                <h3>Learn with an instructor</h3>
                <p>
                  Follow live sessions guided by an instructor who supports your
                  learning journey.
                </p>
              </div>
            </article>

            <article className="detail-experience-point">
              <span className="detail-point-number">02</span>
              <div>
                <h3>Practise in a small group</h3>
                <p>
                  Learn alongside a group of up to eight students, creating room
                  for interaction and participation.
                </p>
              </div>
            </article>

            <article className="detail-experience-point">
              <span className="detail-point-number">03</span>
              <div>
                <h3>Choose a session that fits</h3>
                <p>
                  Review the available cohort dates, schedule and tuition before
                  requesting your place.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* 04 — Choix d'une session */}
        <section
          id="course-schedule"
          className="schedule-section detail-schedule"
          aria-labelledby="schedule-title"
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Take the next step
              </div>

              <h2 id="schedule-title">Find the right session for you.</h2>
            </div>

            <p>
              Compare the upcoming sessions and select the cohort you would like
              to join.
            </p>
          </div>

          {course.cohorts?.length ? (
            <div className="cohort-list">
              {course.cohorts.map((cohort, index) => (
                <article className="cohort-card" key={cohort.id}>
                  <div className="cohort-main">
                    <span className="cohort-label">
                      SESSION {String(index + 1).padStart(2, "0")}
                    </span>

                    <h3>{cohort.name}</h3>

                    <div className="cohort-dates">
                      <span>
                        <span className="cohort-detail-label">Starts</span>
                        {formatDate(cohort.startDate)}
                      </span>

                      <span>
                        <span className="cohort-detail-label">Ends</span>
                        {formatDate(cohort.endDate)}
                      </span>
                    </div>

                    {cohort.scheduleDescription && (
                      <p className="cohort-schedule-description">
                        {cohort.scheduleDescription}
                      </p>
                    )}
                  </div>

                  <div className="cohort-price">
                    <span className="cohort-price-label">Tuition</span>

                    <strong>
                      {formatPrice(cohort.priceXaf ?? course.priceXaf)}
                    </strong>

                    <span className="cohort-seats">
                      {cohort.seatsRemaining} places remaining
                    </span>

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
                ↗
              </div>

              <div>
                <h3>New sessions are being prepared.</h3>
                <p>
                  Contact our team to express your interest and receive
                  information about upcoming enrolment.
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

        {/* 05 — Réservation */}
        {bookingCohort && (
          <section
            ref={bookingSectionRef}
            className="booking-section detail-booking"
            id="course-booking"
            aria-label="Course booking"
            tabIndex={-1}
          >
            <div className="detail-booking-intro">
              <div className="eyebrow">
                <span className="eyebrow-line" />
                Your next step
              </div>

              <h2>One simple step towards your learning goals.</h2>

              <p>
                Reserve your place in the selected session. Our team will guide
                you through the remaining steps before your enrolment is
                confirmed.
              </p>

              <ol className="detail-booking-steps">
                <li>
                  <span className="detail-booking-step-number">01</span>
                  <div>
                    <strong>Submit your request</strong>
                    <p>Share your contact details to register your interest.</p>
                  </div>
                </li>

                <li>
                  <span className="detail-booking-step-number">02</span>
                  <div>
                    <strong>Receive payment instructions</strong>
                    <p>Our team will explain the accepted payment methods.</p>
                  </div>
                </li>

                <li>
                  <span className="detail-booking-step-number">03</span>
                  <div>
                    <strong>Confirm your enrolment</strong>
                    <p>Your place is confirmed after payment verification.</p>
                  </div>
                </li>
              </ol>
            </div>

            <BookingForm
              course={course}
              cohort={bookingCohort}
              onClose={() => setBookingCohort(null)}
            />
          </section>
        )}

        {/* 06 — Questions fréquentes */}
        <section className="detail-faq" aria-labelledby="detail-faq-title">
          <div className="detail-faq-intro">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              BEFORE YOU ENROL
            </div>

            <h2 id="detail-faq-title">A few things worth knowing.</h2>

            <p>
              Here are the answers to common questions about learning with
              Solyce and reserving your place.
            </p>
          </div>

          <div className="detail-faq-list">
            <details className="detail-faq-item">
              <summary>
                <span>How are classes delivered?</span>
                <span className="detail-faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>
                Classes are delivered live with an instructor. Your cohort
                information provides the schedule and details for your session.
              </p>
            </details>

            <details className="detail-faq-item">
              <summary>
                <span>How many learners are in a class?</span>
                <span className="detail-faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>
                Solyce cohorts are designed for a maximum of eight students,
                allowing learners to participate and practise in a small group.
              </p>
            </details>

            <details className="detail-faq-item">
              <summary>
                <span>How do I reserve my place?</span>
                <span className="detail-faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>
                Select an available session, choose “Reserve your place” and
                submit your contact details. You do not need a student account
                to submit a booking request.
              </p>
            </details>

            <details className="detail-faq-item">
              <summary>
                <span>When is my enrolment confirmed?</span>
                <span className="detail-faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>
                Submitting a booking is only a request, not a confirmed
                enrolment. The Solyce team will provide payment instructions,
                and your place is confirmed after the required payment has been
                verified.
              </p>
            </details>

            <details className="detail-faq-item">
              <summary>
                <span>How much does the program cost?</span>
                <span className="detail-faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>
                The program tuition is displayed above. If a session has its own
                price, the amount shown for that session applies. Review the
                available sessions before submitting your booking.
              </p>
            </details>

            <details className="detail-faq-item">
              <summary>
                <span>What if no session is available?</span>
                <span className="detail-faq-toggle" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>
                If there are no upcoming sessions listed, contact the Solyce
                team to express your interest and ask about future enrolment.
              </p>
            </details>
          </div>
        </section>

        {/* 07 — Appel à l'action final */}
        <section className="detail-final-cta">
          <span className="detail-final-cta-mark" aria-hidden="true">
            S.
          </span>

          <div className="eyebrow">
            <span className="eyebrow-line" />
            YOUR NEXT CHAPTER STARTS HERE
          </div>

          <h2>Ready to take your next step?</h2>

          <p>
            Explore the upcoming sessions and choose the learning path that best
            fits your goals.
          </p>

          <div className="detail-final-cta-actions">
            <a className="button button-primary" href="#course-schedule">
              Explore available sessions <ArrowIcon />
            </a>

            <button
              className="button button-outline"
              type="button"
              onClick={onBack}
            >
              Explore other programs
            </button>
          </div>
        </section>
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

  async function selectCourse(course) {
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/courses/${encodeURIComponent(course.slug)}`,
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.data) {
        throw new Error(
          result?.error?.message ||
            "Unable to load this program's details. Please try again.",
        );
      }

      setSelectedCourse(result.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Unable to reach Solyce. Please check your connection."
          : err.message,
      );
    }
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
            <a href="/about">About Solyce</a>
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
                  Learn with purpose.
                  <br />
                  <span>Grow with guidance.</span>
                </h2>
              </div>

              <div className="principles-grid">
                <article className="principle">
                  <span className="principle-number">01 / GUIDANCE</span>
                  <h3>Learn with an instructor.</h3>
                  <p>
                    Build your language skills through live classes led by an
                    instructor, with guidance throughout your learning journey.
                  </p>
                </article>

                <article className="principle">
                  <span className="principle-number">02 / COMMUNITY</span>
                  <h3>Learn in a small group.</h3>
                  <p>
                    Join a class of up to eight learners and practise alongside
                    others working toward their language goals.
                  </p>
                </article>

                <article className="principle">
                  <span className="principle-number">03 / PURPOSE</span>
                  <h3>Move toward your goal.</h3>
                  <p>
                    Choose a language program built around a clear objective,
                    whether you are preparing for an exam or strengthening your
                    communication skills.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section
            className="learning-story"
            aria-labelledby="learning-story-title"
          >
            <div className="container learning-story-layout">
              <div className="learning-story-visual">
                <img
                  src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85"
                  alt="Students learning and exchanging ideas together"
                  loading="lazy"
                  decoding="async"
                />
                <span className="learning-story-label">
                  LEARN TOGETHER. MOVE FORWARD.
                </span>
              </div>

              <div className="learning-story-copy">
                <span className="section-kicker">BEYOND THE CLASSROOM</span>

                <h2 id="learning-story-title">
                  Confidence grows
                  <br />
                  <span>through practice.</span>
                </h2>

                <p>
                  Learning a language is more than memorising words. It is about
                  expressing yourself, asking questions, and building the
                  confidence to take your next step. With live guidance and a
                  small learning group, every class becomes an opportunity to
                  practise.
                </p>

                <a className="learning-story-link" href="#programs">
                  Explore our programs <ArrowIcon />
                </a>

                <span className="learning-story-index" aria-hidden="true">
                  SOLYCE / 01
                </span>
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
                <div
                  className="filter-tabs"
                  role="group"
                  aria-label="Filter programs by language"
                >
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
                <div
                  className="catalogue-status"
                  role="status"
                  aria-live="polite"
                >
                  <span className="loading-spinner" aria-hidden="true" />
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
                  <div
                    className="results-caption"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
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
                <div
                  className="catalogue-status"
                  role="status"
                  aria-live="polite"
                >
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
              <div className="closing-copy">
                <span className="section-kicker">
                  YOUR NEXT CHAPTER STARTS HERE
                </span>

                <h2>
                  Your goals.
                  <br />
                  <span>Your next step.</span>
                </h2>
              </div>

              <div className="closing-action">
                <p>
                  Tell us what you want to achieve. Explore our language
                  programs or talk to our team to find the right starting point.
                </p>

                <div className="closing-buttons">
                  <a className="button button-light" href="#programs">
                    Explore programs <ArrowIcon />
                  </a>

                  <a
                    className="closing-contact-link"
                    href="mailto:hello@solyce.com?subject=Let's%20talk%20about%20Solyce"
                  >
                    Talk to our team <ArrowIcon diagonal />
                  </a>
                </div>
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
            <a href="/about">About Solyce</a>
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
          <span>
            Â© {new Date().getFullYear()} Solyce. All rights reserved.
          </span>
          <span>Built around your next chapter.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
