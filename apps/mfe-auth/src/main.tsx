import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator && window.location.hostname === "localhost") {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

// Catch uncaught JS errors and show them on screen instead of a silent blank page
window.addEventListener("error", (e) => {
  const root = document.getElementById("root");
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#dc2626">
      <b>App failed to start</b><br/><code style="font-size:12px">${e.message}</code>
    </div>`;
  }
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif", color: "#dc2626" }}>
          <b>App failed to start</b>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
