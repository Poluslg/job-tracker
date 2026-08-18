import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@job-ai/ui";
import "../styles.css";
import { ErrorBoundary } from "../components/ErrorBoundary.tsx";
import { Onboarding } from "./Onboarding.tsx";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <Onboarding />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
