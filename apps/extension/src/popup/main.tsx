import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@job-ai/ui";
import "../styles.css";
import { App } from "./App.tsx";
import { ErrorBoundary } from "../components/ErrorBoundary.tsx";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
