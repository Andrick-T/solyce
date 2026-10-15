$ErrorActionPreference = "Stop"

$root = Get-Location
$mainPath = Join-Path $root "client\src\main.jsx"
$studentPath = Join-Path $root "client\src\student\StudentApp.jsx"
$studentCssPath = Join-Path $root "client\src\student\StudentApp.css"

if (-not (Test-Path $mainPath)) {
  throw "Cannot find client\src\main.jsx. Run this script from the Solyce project root."
}
if (-not (Test-Path (Join-Path $root "client\package.json"))) {
  throw "Cannot find client\package.json. Run this script from the Solyce project root."
}

$main = Get-Content -Raw -Encoding UTF8 $mainPath
if ($main -notmatch 'StudentApp\.jsx') {
  $backup = "$mainPath.bak-student-space-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $mainPath $backup
  $newMain = @'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import StudentApp from "./student/StudentApp.jsx";

const path = window.location.pathname;
export const Root = path.startsWith("/admin")
  ? AdminApp
  : path.startsWith("/student")
    ? StudentApp
    : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
'@
  Set-Content -Path $mainPath -Value $newMain -Encoding UTF8
} else {
  Write-Host "main.jsx already imports StudentApp; leaving it unchanged."
}

New-Item -ItemType Directory -Force -Path (Split-Path $studentPath) | Out-Null

$studentJsx = @'
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
'@
Set-Content -Path $studentPath -Value $studentJsx -Encoding UTF8

$studentCss = @'
.student-app{--st-ink:#1c2923;--st-muted:#7b8177;--st-paper:#f7f7f1;--st-line:#e7e8df;--st-green:#d8ed91;display:flex;min-height:100vh;background:var(--st-paper);color:var(--st-ink);font-family:var(--sans)}
.student-app button{font:inherit;cursor:pointer}.student-app button:focus-visible{outline:3px solid #91ab5b;outline-offset:3px}.student-sidebar{position:fixed;z-index:30;inset:0 auto 0 0;display:flex;width:254px;flex-direction:column;padding:25px 17px 16px;border-right:1px solid var(--st-line);background:#fff}.student-sidebar-top{display:flex;align-items:center;justify-content:space-between;padding:0 8px 26px}.student-brand{display:flex;align-items:center;gap:10px;color:var(--st-ink);font-family:var(--heading);font-size:21px;font-weight:800;letter-spacing:-1px}.student-brand-mark{display:grid;width:33px;height:33px;place-items:center;border:1px solid #b9c7a2;border-radius:50%;font-family:var(--serif);font-size:19px;font-style:italic;font-weight:400}.student-brand-period{color:#8da257}.student-mobile-close,.student-menu-toggle{display:none;border:0;background:transparent;font-size:24px}.student-profile-mini{display:flex;align-items:center;gap:10px;padding:14px 10px 20px;border-top:1px solid var(--st-line);border-bottom:1px solid var(--st-line)}.student-avatar,.student-top-avatar{display:grid;width:35px;height:35px;flex-shrink:0;place-items:center;border-radius:50%;background:#eaf0dd;color:#50623b;font-family:var(--serif);font-size:19px;font-style:italic}.student-profile-mini>div:nth-child(2){display:grid;gap:4px;min-width:0}.student-profile-mini strong{font-size:11px}.student-profile-mini span{color:var(--st-muted);font-size:9px}.student-profile-mini .student-profile-dots{margin-left:auto;font-size:19px}.student-navigation{flex:1;overflow:auto;padding-top:23px}.student-nav-group{margin-bottom:23px}.student-nav-group>p{margin:0 10px 10px;color:#969b8f;font-size:8px;font-weight:700;letter-spacing:.14em}.student-nav-item{display:flex;width:100%;min-height:40px;align-items:center;gap:11px;margin:2px 0;padding:0 11px;border:0;border-radius:4px;color:#697166;background:transparent;font-size:10px;text-align:left;transition:background .15s,color .15s}.student-nav-item:hover{background:#f5f6f0;color:var(--st-ink)}.student-nav-item.active{background:#edf2e2;color:#314127;font-weight:700}.student-nav-icon{display:grid;width:19px;place-items:center;font-size:15px}.student-nav-count{display:grid;width:19px;height:19px;place-items:center;margin-left:auto;border-radius:50%;background:#fff;font-size:9px}.student-sidebar-bottom{padding-top:15px;border-top:1px solid var(--st-line)}.student-help-card{padding:14px 13px;border:1px solid #e6e9de;background:#f8f9f3}.student-help-symbol{display:grid;width:23px;height:23px;place-items:center;border:1px solid #d3ddc0;border-radius:50%;color:#6c804b;font-size:12px}.student-help-card strong{display:block;margin-top:12px;font-size:11px}.student-help-card p{margin:7px 0 12px;color:var(--st-muted);font-size:9px;line-height:1.7}.student-help-card button{display:flex;width:100%;justify-content:space-between;padding:9px 0 0;border:0;border-top:1px solid #e3e7d9;background:transparent;font-size:9px;font-weight:700}.student-signout{display:flex;width:100%;align-items:center;gap:10px;padding:17px 10px 4px;border:0;color:#697166;background:transparent;font-size:9px;text-align:left}.student-main{display:flex;min-width:0;min-height:100vh;flex:1;flex-direction:column;margin-left:254px}.student-topbar{position:sticky;z-index:10;top:0;display:flex;height:68px;align-items:center;justify-content:space-between;gap:20px;padding:0 clamp(24px,4vw,55px);border-bottom:1px solid var(--st-line);background:#ffffffed;backdrop-filter:blur(10px)}.student-breadcrumb{color:#8a9085;font-size:10px}.student-breadcrumb span{padding:0 9px;color:#c0c4b8}.student-breadcrumb strong{color:#344036;font-weight:600}.student-top-actions{display:flex;align-items:center;gap:18px}.student-date-label{color:#899083;font-size:8px;font-weight:700;letter-spacing:.13em}.student-notification{position:relative;width:32px;height:32px;border:1px solid var(--st-line);border-radius:50%;background:#fff;font-size:17px}.student-notification i{position:absolute;top:6px;right:6px;width:5px;height:5px;border-radius:50%;background:#92a75c}.student-top-avatar{width:30px;height:30px;font-size:16px}.student-content{width:min(1440px,100%);flex:1;margin:0 auto;padding:37px clamp(24px,4vw,55px) 30px}.student-welcome{position:relative;display:grid;min-height:300px;grid-template-columns:1.1fr .9fr;overflow:hidden;background:#1c2923;color:#fff}.student-welcome>div:first-child{z-index:1;padding:34px 0 32px 37px}.student-eyebrow{display:flex;align-items:center;gap:8px;margin:0;color:#7b866c;font-size:8px;font-weight:700;letter-spacing:.14em}.student-eyebrow>span{width:17px;height:1px;background:#b9ca87}.student-welcome .student-eyebrow{color:#c6d0bc}.student-welcome h1,.student-page-heading h1{margin:18px 0 0;font-family:var(--heading);font-size:clamp(34px,3.3vw,48px);font-weight:500;letter-spacing:-.065em;line-height:1.13}.student-welcome h1 em{color:var(--st-green);font-family:var(--serif);font-weight:400}.student-welcome-copy{max-width:410px;margin:16px 0 0;color:#c3cbc0;font-size:10px;line-height:1.9}.student-welcome-actions{display:flex;flex-wrap:wrap;align-items:center;gap:17px;margin-top:22px}.student-primary-button{display:inline-flex;min-height:39px;align-items:center;gap:20px;padding:0 14px;border:0;background:var(--st-green);color:#263426;font-size:9px;font-weight:700}.student-primary-button span{font-size:13px}.student-text-button{padding:8px 0;border:0;color:#e7eadf;background:transparent;font-size:9px}.student-text-button span{padding-left:7px}.student-welcome-art{position:relative;display:grid;min-height:260px;place-items:center;overflow:hidden;background:radial-gradient(ellipse at 52% 50%,#45533b 0,#2b392d 44%,#1c2923 76%)}.student-art-ring{position:absolute;width:min(68%,270px);aspect-ratio:1;border:1px solid #d8ed9140;border-radius:50%}.ring-one{transform:scaleX(.65) rotate(28deg)}.ring-two{transform:scaleX(.65) rotate(-28deg)}.student-art-core{display:grid;width:116px;aspect-ratio:1;place-items:center;border:1px solid #f0f3d8;border-radius:50%;background:radial-gradient(circle at 35% 25%,#e6f2bd,#b4ce7c 67%,#7c9253);color:#263426;font-family:var(--serif);font-size:80px;font-style:italic;box-shadow:0 0 55px #d8ed9118}.student-art-core span{color:#647a43}.student-art-label{position:absolute;padding:8px 10px;border:1px solid #ffffff25;background:#1c2923e8;color:#e4e9dc;font-size:7px;letter-spacing:.08em}.art-label-one{top:17%;left:9%}.art-label-two{top:48%;right:5%}.art-label-three{bottom:15%;left:15%}.student-art-cross{position:absolute;top:23%;right:21%;color:var(--st-green);font-size:20px}.student-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:17px}.student-stat-card{min-width:0;padding:17px 17px 15px;border:1px solid var(--st-line);background:#fff}.student-stat-top{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#7d8478;font-size:7px;font-weight:700;letter-spacing:.09em}.student-stat-icon{display:grid;width:26px;height:26px;flex-shrink:0;place-items:center;border:1px solid #e5e9dc;border-radius:50%;color:#70814e;font-size:12px}.student-stat-card>strong{display:block;margin-top:15px;font-family:var(--heading);font-size:27px;font-weight:600;letter-spacing:-.06em}.student-stat-card>strong small{font-size:14px}.student-stat-card>p{margin:5px 0 0;color:#898f83;font-size:8px;line-height:1.5}.student-dashboard-grid{display:grid;grid-template-columns:1.3fr .9fr;gap:13px;margin-top:18px}.student-panel{min-width:0;border:1px solid var(--st-line);background:#fff}.student-program-panel,.student-agenda-panel{min-height:280px;padding:21px 22px}.student-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:15px}.student-panel-heading h2,.student-tip-card h2,.student-profile-notice h2{margin:7px 0 0;font-family:var(--heading);font-size:17px;font-weight:600;letter-spacing:-.045em}.student-inline-link,.student-icon-link{border:0;color:#6f7f4c;background:transparent;font-size:9px;font-weight:700}.student-inline-link span{padding-left:7px}.student-icon-link{display:grid;width:29px;height:29px;place-items:center;border:1px solid var(--st-line);border-radius:50%;font-size:13px}.student-empty{display:flex;min-height:178px;flex-direction:column;align-items:center;justify-content:center;padding:20px;text-align:center}.student-empty-icon{display:grid;width:38px;height:38px;place-items:center;border:1px solid #dfe5d4;border-radius:50%;color:#82945a;font-size:18px}.student-empty h3{margin:13px 0 6px;font-family:var(--heading);font-size:12px;font-weight:600;letter-spacing:-.025em}.student-empty p{max-width:340px;margin:0;color:#82887d;font-size:9px;line-height:1.8}.student-bottom-grid{display:grid;grid-template-columns:1.3fr .9fr;gap:13px;margin-top:13px}.student-tip-card{position:relative;display:flex;min-height:151px;align-items:flex-start;gap:16px;padding:21px;background:#edf0e4}.student-tip-mark{display:grid;width:31px;height:31px;flex-shrink:0;place-items:center;border:1px solid #d2dcc0;border-radius:50%;color:#75884c;font-size:17px}.student-tip-card h2{font-size:15px;line-height:1.45}.student-tip-card>div:nth-child(2)>p:last-child{max-width:340px;margin:8px 0 0;color:#72796c;font-size:9px;line-height:1.8}.student-tip-index{position:absolute;right:17px;bottom:13px;color:#8b9380;font-size:7px;letter-spacing:.1em}.student-quick-panel{padding:18px 20px}.student-quick-panel>.student-eyebrow{margin-bottom:9px}.student-quick-panel>button{display:flex;width:100%;min-height:34px;align-items:center;gap:9px;border:0;border-top:1px solid #eff0e9;color:#515b4d;background:transparent;font-size:9px;text-align:left}.student-quick-panel>button>span{color:#839459;font-size:14px}.student-quick-panel>button>b{margin-left:auto;color:#87936d;font-weight:400}.student-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:16px clamp(24px,4vw,55px);border-top:1px solid var(--st-line);color:#8a9085;font-size:8px}.student-footer button{padding:0;border:0;color:#65774b;background:transparent;font-size:8px;font-weight:700}.student-subpage{padding-top:52px}.student-page-heading{padding:0 0 30px;border-bottom:1px solid var(--st-line)}.student-page-heading h1{margin-top:12px;color:var(--st-ink);font-size:clamp(35px,4vw,48px)}.student-page-heading>p:last-child{max-width:580px;margin:13px 0 0;color:#7d8478;font-size:11px;line-height:1.8}.student-subpage-panel{margin-top:20px;padding:25px}.student-subpage-panel .student-empty{min-height:300px}.student-profile-notice{display:flex;align-items:center;gap:17px;margin-top:20px;padding:25px}.student-avatar.large{width:55px;height:55px;font-size:27px}.student-profile-notice h2{margin:0}.student-profile-notice p{max-width:550px;margin:8px 0 0;color:#7d8478;font-size:10px;line-height:1.8}.student-nav-backdrop{display:none}
@media(max-width:1100px){.student-sidebar{width:225px}.student-main{margin-left:225px}.student-content{padding-inline:25px}.student-topbar{padding-inline:25px}.student-welcome>div:first-child{padding-left:27px}.student-welcome h1{font-size:38px}.student-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.student-dashboard-grid,.student-bottom-grid{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.student-sidebar{z-index:50;width:270px;transform:translateX(-100%);transition:transform .22s ease;box-shadow:none}.student-sidebar.is-open{transform:translateX(0);box-shadow:20px 0 70px #101b1620}.student-mobile-close{display:block}.student-nav-backdrop{position:fixed;z-index:40;inset:0;display:block;border:0;background:#111b1680}.student-main{margin-left:0}.student-topbar{height:60px;padding-inline:17px}.student-menu-toggle{display:block;padding:4px 7px;font-size:19px}.student-breadcrumb{flex:1;font-size:9px}.student-top-actions{gap:10px}.student-date-label{display:none}.student-content{padding:20px 15px 25px}.student-welcome{grid-template-columns:1fr}.student-welcome>div:first-child{padding:27px 23px 22px}.student-welcome h1{font-size:39px}.student-welcome-copy{max-width:430px}.student-welcome-art{min-height:210px}.student-art-core{width:93px;font-size:65px}.student-art-ring{width:210px}.student-stat-grid{gap:8px;margin-top:10px}.student-stat-card{padding:13px}.student-stat-top{font-size:6px;letter-spacing:.04em}.student-stat-icon{width:22px;height:22px}.student-stat-card>strong{margin-top:12px;font-size:25px}.student-dashboard-grid,.student-bottom-grid{grid-template-columns:1fr;gap:10px;margin-top:10px}.student-program-panel,.student-agenda-panel{min-height:235px;padding:17px}.student-empty{min-height:145px}.student-tip-card{min-height:150px;padding:18px 15px}.student-tip-card h2{font-size:14px}.student-quick-panel{padding:16px}.student-footer{align-items:flex-start;flex-wrap:wrap;padding:15px;font-size:7px}.student-subpage{padding-top:34px}.student-page-heading{padding-bottom:23px}.student-page-heading h1{font-size:36px}.student-subpage-panel{padding:12px}.student-profile-notice{align-items:flex-start;padding:18px}.student-profile-notice h2{font-size:15px}}
@media(max-width:360px){.student-welcome h1{font-size:34px}.student-stat-card{padding:10px}.student-stat-top{align-items:flex-start}.student-stat-icon{display:none}.student-welcome-actions{gap:12px}.student-primary-button{gap:10px;padding-inline:10px}}
'@
Set-Content -Path $studentCssPath -Value $studentCss -Encoding UTF8

Write-Host "Student portal shell installed." -ForegroundColor Green
Write-Host "Created: $studentPath"
Write-Host "Created: $studentCssPath"
if (Test-Path $backup) { Write-Host "Backup created: $backup" }
Write-Host "This phase installs the responsive dashboard/navigation shell only. Student authentication and live data APIs are intentionally not simulated; they are the next backend step."
Write-Host "Next: npm --prefix client run build"
