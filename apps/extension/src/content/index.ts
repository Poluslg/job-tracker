import type { ExtMessage, JobExtractionResult } from "@job-ai/types";
import {
  MIN_DETECTION_CONFIDENCE,
  extractFromSelection,
  extractJobFromDocument,
  urlLooksLikeJob,
} from "@job-ai/core";
import {
  cancelManualSelection,
  removeOverlay,
  renderFab,
  showToast,
  startManualSelection,
} from "./overlay.ts";

let lastResult: JobExtractionResult | null = null;
let lastUrl = location.href;
let showFab = true;

function detect(): JobExtractionResult {
  try {
    lastResult = extractJobFromDocument(document, location.href);
  } catch (err) {
    lastResult = {
      ok: false,
      confidence: 0,
      strategiesTried: ["error"],
      reason:
        err instanceof Error
          ? `Extraction failed: ${err.message}`
          : "Extraction failed.",
    };
  }
  return lastResult;
}

function openPopupHint(): void {
  showToast(
    "Click the AI Career Copilot icon in your toolbar to see your match.",
  );
}

function updateFab(result: JobExtractionResult): void {
  if (!showFab) {
    removeOverlay();
    return;
  }
  if (result.ok) {
    renderFab({
      label: "Analyze this job",
      detected: true,
      onClick: openPopupHint,
    });
  } else if (urlLooksLikeJob(location.href)) {
    renderFab({
      label: "Select job description",
      detected: false,
      onClick: () =>
        startManualSelection(
          (text) => {
            lastResult = extractFromSelection(document, location.href, text);
            void chrome.runtime
              .sendMessage({ type: "JOB_DETECTED", payload: lastResult })
              .catch(() => {});
            showToast("Got it. Open the extension to analyze this job.");
            updateFab(lastResult);
          },
          () => updateFab(result),
        ),
    });
  } else {
    removeOverlay();
  }
}

async function run(): Promise<void> {
  const result = detect();
  try {
    const settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (settings?.ok) showFab = settings.data.ui.showFloatingButton;
  } catch {}
  updateFab(result);
  if (result.ok) {
    void chrome.runtime
      .sendMessage({ type: "JOB_DETECTED", payload: result })
      .catch(() => {});
  }
}

function watchForNavigation(): void {
  const check = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    cancelManualSelection();

    setTimeout(() => void run(), 700);
  };

  const observer = new MutationObserver(() => {
    check();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("popstate", check);
}

chrome.runtime.onMessage.addListener(
  (message: ExtMessage, _sender, sendResponse) => {
    switch (message.type) {
      case "EXTRACT_JOB": {
        const result =
          message.payload?.force || !lastResult ? detect() : lastResult;
        sendResponse({ ok: true, data: result });
        return false;
      }
      case "START_MANUAL_SELECTION": {
        startManualSelection(
          (text) => {
            lastResult = extractFromSelection(document, location.href, text);
            void chrome.runtime
              .sendMessage({ type: "JOB_DETECTED", payload: lastResult })
              .catch(() => {});
            showToast("Got it. Open the extension to analyze this job.");
          },
          () => {},
        );
        sendResponse({ ok: true, data: { ok: true } });
        return false;
      }
      case "CANCEL_MANUAL_SELECTION": {
        cancelManualSelection();
        sendResponse({ ok: true, data: { ok: true } });
        return false;
      }
      default:
        return false;
    }
  },
);

if (document.readyState === "complete") void run();
else window.addEventListener("load", () => void run(), { once: true });

setTimeout(() => {
  if (lastResult && lastResult.confidence < MIN_DETECTION_CONFIDENCE)
    void run();
}, 2500);

watchForNavigation();
