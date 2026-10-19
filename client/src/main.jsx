import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AdminApp from "./admin/AdminApp.jsx";
import StudentApp from "./student/StudentApp.jsx";
import InstructorApp from "./instructor/InstructorApp.jsx";

const path = window.location.pathname;

export const Root = path.startsWith("/admin")
  ? AdminApp
  : path.startsWith("/instructor")
    ? InstructorApp
    : path.startsWith("/student")
      ? StudentApp
      : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
