import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AdminApp from "./admin/AdminApp.jsx";

export const Root = window.location.pathname.startsWith("/admin") ? AdminApp : App;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
