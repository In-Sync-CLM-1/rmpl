import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error handler for uncaught errors
window.addEventListener("error", (event) => {
  console.error("[GLOBAL ERROR]", {
    timestamp: new Date().toISOString(),
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
    route: window.location.pathname,
  });
});

// Global handler for unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.error("[UNHANDLED PROMISE REJECTION]", {
    timestamp: new Date().toISOString(),
    reason: event.reason,
    promise: event.promise,
    route: window.location.pathname,
  });
});

createRoot(document.getElementById("root")!).render(<App />);
