import { useState } from "react";
import "./StudentApp.css";

const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "▦", group: "LEARNING" },
  { id: "courses", label: "My learning", icon: "▤", group: "LEARNING" },
  { id: "schedule", label: "My schedule", icon: "▦", group: "LEARNING" },
  { id: "assignments", label: "Assignments & assessments", icon: "✓", group: "LEARNING" },
  { id: "resources", label: "Resources", icon: "▧", group: "LEARNING" },
  { id: "payments", label: "Payments", icon: "◇", group: "ACCOUNT" },
  { id: "profile", label: "My profile", icon: "○", group: "ACCOUNT" },
  { id: "support", label: "Help & support", icon: "?", group: "ACCOUNT" },
];

const pageCopy = {
  courses: { eyebrow: "YOUR LEARNING PATH", title: "My learning", description: "Your confirmed learning programs and the progress you make in each one." },
  schedule: { eyebrow: "PLAN AHEAD", title: "My schedule", description: "Your upcoming classes, important dates and learning milestones." },
  assignments: { eyebrow: "PRACTICE & FEEDBACK", title: "Assignments & assessments", description: "Keep track of tasks, submissions, quizzes and feedback from your instructors." },
  resources: { eyebrow: "YOUR LEARNING LIBRARY", title: "Resources", description: "Course documents, recordings and learning materials in one place." },
  payments: { eyebrow: "ACCOUNT OVERVIEW", title: "Payments", description: "Review the payment status and payment history associated with your enrolments." },
  profile: { eyebrow: "YOUR ACCOUNT", title: "My profile", description: "Manage your contact details and account preferences." },
  support: { eyebrow: "WE ARE HERE TO HELP", title: "Help & support", description: "Find help with your account, enrolment or learning experience." },
};

function StudentBrand() {
  return <a className="student-brand" href="/student" aria-label="Solyce student home"><span className="student-brand-mark">S.</span><span>solyce<span className="student-brand-period">.</span></span></a>;
}

function EmptyState({ title, children }) {
  return <div className="student-empty"><div className="student-empty-icon">✳</div><h3>{title}</h3><p>{children}</p></div>;
}

export default function StudentApp() {
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const studentName = "Student";
  const currentPage = pageCopy[activePage];

  function navigate(id) {
    setActivePage(id);
    setMobileNavOpen(false);
    window.history.replaceState({}, "", id === "dashboard" ? "/student" : `/student/${id}`);
  }

  function signOut() {
    // Authentication is connected in the next backend step; do not pretend to end a server session here.
    window.location.assign("/");
  }

  return (
    <div className="student-app">
      <aside className={`student-sidebar${mobileNavOpen ? " is-open" : ""}`}>
        <div className="student-sidebar-top"><StudentBrand /><button className="student-mobile-close" type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation">×</button></div>
        <div className="student-profile-mini"><div className="student-avatar">S</div><div><strong>{studentName}</strong><span>Student account</span></div><span className="student-profile-dots">···</span></div>
        <nav className="student-navigation" aria-label="Student navigation">
          { ["LEARNING", "ACCOUNT"].map((group) => <div className="student-nav-group" key={group}><p>{group}</p>{navigation.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" className={`student-nav-item${activePage === item.id ? " active" : ""}`} onClick={() => navigate(item.id)}><span className="student-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.id === "assignments" && <span className="student-nav-count">0</span>}</button>)}</div>) }
        </nav>
        <div className="student-sidebar-bottom"><div className="student-help-card"><span className="student-help-symbol">?</span><strong>Need a hand?</strong><p>Our team is here to help you move forward.</p><button type="button" onClick={() => navigate("support")}>Visit support <span>↗</span></button></div><button type="button" className="student-signout" onClick={signOut}><span>↪</span> Back to Solyce website</button></div>
      </aside>

      {mobileNavOpen && <button className="student-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="student-main">
        <header className="student-topbar"><button className="student-menu-toggle" type="button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">☰</button><div className="student-breadcrumb">Student portal <span>/</span> <strong>{activePage === "dashboard" ? "Dashboard" : navigation.find((item) => item.id === activePage)?.label}</strong></div><div className="student-top-actions"><span className="student-date-label">YOUR LEARNING SPACE</span><button type="button" className="student-notification" aria-label="Notifications">♧<i /></button><div className="student-top-avatar">S</div></div></header>

        {activePage === "dashboard" ? <div className="student-content">
          <section className="student-welcome"><div><p className="student-eyebrow"><span /> YOUR NEXT CHAPTER</p><h1>Make progress,<br /><em>one step at a time.</em></h1><p className="student-welcome-copy">Welcome to your Solyce learning space. Your courses, resources and milestones will come together here.</p><div className="student-welcome-actions"><button type="button" className="student-primary-button" onClick={() => navigate("courses")}>Explore my learning <span>↗</span></button><button type="button" className="student-text-button" onClick={() => navigate("schedule")}>View schedule <span>→</span></button></div></div><div className="student-welcome-art"><div className="student-art-ring ring-one"/><div className="student-art-ring ring-two"/><div className="student-art-core">S<span>.</span></div><span className="student-art-label art-label-one">01 / CLARITY</span><span className="student-art-label art-label-two">02 / PRACTICE</span><span className="student-art-label art-label-three">03 / PROGRESS</span><span className="student-art-cross">+</span></div></section>

          <section className="student-stat-grid" aria-label="Learning overview"><article className="student-stat-card"><div className="student-stat-top"><span>ACTIVE PROGRAMS</span><span className="student-stat-icon">▤</span></div><strong>—</strong><p>Your confirmed courses</p></article><article className="student-stat-card"><div className="student-stat-top"><span>LEARNING PROGRESS</span><span className="student-stat-icon">↗</span></div><strong>—<small>%</small></strong><p>Progress across your lessons</p></article><article className="student-stat-card"><div className="student-stat-top"><span>UPCOMING SESSIONS</span><span className="student-stat-icon">▦</span></div><strong>—</strong><p>Your next scheduled classes</p></article><article className="student-stat-card"><div className="student-stat-top"><span>TO-DO</span><span className="student-stat-icon">✓</span></div><strong>—</strong><p>Assignments awaiting action</p></article></section>

          <section className="student-dashboard-grid"><div className="student-panel student-program-panel"><div className="student-panel-heading"><div><p className="student-eyebrow">YOUR JOURNEY</p><h2>Continue learning</h2></div><button type="button" className="student-inline-link" onClick={() => navigate("courses")}>View all <span>→</span></button></div><EmptyState title="Your learning journey starts here">Once your enrolment is confirmed and linked to your account, your programs and next lessons will appear here.</EmptyState></div><div className="student-panel student-agenda-panel"><div className="student-panel-heading"><div><p className="student-eyebrow">KEEP ON TRACK</p><h2>Coming up</h2></div><button type="button" className="student-icon-link" onClick={() => navigate("schedule")} aria-label="Open schedule">↗</button></div><EmptyState title="Nothing scheduled yet">Your upcoming classes and important dates will be shown here.</EmptyState></div></section>

          <section className="student-bottom-grid"><div className="student-tip-card"><div className="student-tip-mark">✳</div><div><p className="student-eyebrow">THE SOLYCE METHOD</p><h2>Small, consistent steps<br />create meaningful progress.</h2><p>Return regularly, practise deliberately and keep your learning goals in sight.</p></div><span className="student-tip-index">01 — 03</span></div><div className="student-panel student-quick-panel"><p className="student-eyebrow">QUICK ACCESS</p><button type="button" onClick={() => navigate("resources")}><span>▧</span> Learning resources <b>→</b></button><button type="button" onClick={() => navigate("assignments")}><span>✓</span> Assignments <b>→</b></button><button type="button" onClick={() => navigate("payments")}><span>◇</span> Payment details <b>→</b></button></div></section>
        </div> : <div className="student-content student-subpage"><div className="student-page-heading"><p className="student-eyebrow"><span /> {currentPage.eyebrow}</p><h1>{currentPage.title}</h1><p>{currentPage.description}</p></div>{activePage === "profile" ? <div className="student-panel student-profile-notice"><div className="student-avatar large">S</div><div><h2>Your student profile</h2><p>Your verified account details will be available here once student authentication is connected.</p></div></div> : <div className="student-panel student-subpage-panel"><EmptyState title={activePage === "courses" ? "Your programs will appear here" : activePage === "schedule" ? "Your schedule is taking shape" : activePage === "assignments" ? "No assignments to show yet" : activePage === "resources" ? "Your learning library is being prepared" : activePage === "payments" ? "Your payment overview will appear here" : "How can we help?"}>{activePage === "support" ? "Support requests and contact options will be connected in a later step." : "This section is part of the student portal structure. We will connect it to authenticated API data and the learning models in the next implementation step."}</EmptyState></div>}</div>}

        <footer className="student-footer"><span>© {new Date().getFullYear()} Solyce Learning</span><span>Purposeful learning. Meaningful progress.</span><button type="button" onClick={() => navigate("support")}>Need help?</button></footer>
      </main>
    </div>
  );
}
