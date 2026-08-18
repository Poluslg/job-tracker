import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "@job-ai/ui";
import "../styles.css";
import { ErrorBoundary } from "../components/ErrorBoundary.tsx";
import { Options } from "./Options.tsx";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ToastProvider>
          <Options />
        </ToastProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
