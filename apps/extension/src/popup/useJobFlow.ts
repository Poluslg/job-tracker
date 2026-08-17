import type {
  AnalysisStage,
  ExtensionState,
  JobAnalysis,
  JobPosting,
  UserSettings,
} from "@job-ai/types";
import { STAGE_LABELS } from "@job-ai/types";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageError,
  getActiveTab,
  isRestrictedUrl,
  send,
  sendToTab,
} from "../lib/messaging.ts";
import { applyTheme } from "../lib/theme.ts";

export type PageStatus =
  | "loading"
  | "restricted"
  | "no-resume"
  | "no-job"
  | "detected"
  | "analyzing"
  | "analyzed";

export interface JobFlow {
  status: PageStatus;
  state: ExtensionState | null;
  settings: UserSettings | null;
  job: JobPosting | null;
  analysis: JobAnalysis | null;
  stage: AnalysisStage;
  error: string | null;

  degraded: string | null;
  tabId: number | null;
  analyze: () => Promise<void>;
  selectManually: () => Promise<void>;
  redetect: () => Promise<void>;
  refresh: () => Promise<void>;
  setAnalysis: (analysis: JobAnalysis) => void;
}

export function useJobFlow(): JobFlow {
  const [status, setStatus] = useState<PageStatus>("loading");
  const [state, setState] = useState<ExtensionState | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [job, setJob] = useState<JobPosting | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [stage, setStage] = useState<AnalysisStage>("detecting");
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);

  const themeCleanup = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setStatus("loading");

    try {
      const [nextState, nextSettings] = await Promise.all([
        send({ type: "GET_STATE" }),
        send({ type: "GET_SETTINGS" }),
      ]);
      setState(nextState);
      setSettings(nextSettings);

      themeCleanup.current?.();
      themeCleanup.current = applyTheme(nextSettings.ui.theme);

      if (!nextState.hasResume) {
        setStatus("no-resume");
        return;
      }

      const tab = await getActiveTab();
      setTabId(tab?.id ?? null);

      if (!tab?.id || isRestrictedUrl(tab.url)) {
        setStatus("restricted");
        return;
      }

      const detection = await sendToTab(tab.id, { type: "EXTRACT_JOB" });
      if (!detection.ok || !detection.job?.description) {
        setStatus("no-job");
        setError(detection.reason || "No job description found on this page.");
        return;
      }

      const active = await send({
        type: "GET_ACTIVE_JOB",
        payload: { tabId: tab.id },
      });
      setJob(active.job ?? (detection.job as JobPosting));
      if (active.analysis) {
        setAnalysis(active.analysis);
        setStatus("analyzed");
      } else {
        setStatus("detected");
      }
    } catch (err) {
      setError(
        err instanceof MessageError ? err.message : "Could not read this page.",
      );
      setStatus(
        err instanceof MessageError && err.code === "no-content-script"
          ? "restricted"
          : "no-job",
      );
    }
  }, []);

  useEffect(() => {
    void load();
    return () => themeCleanup.current?.();
  }, [load]);

  useEffect(() => {
    const listener = (message: {
      type?: string;
      payload?: { stage?: string };
    }) => {
      if (message.type === "PROGRESS" && message.payload?.stage) {
        const next = message.payload.stage as AnalysisStage;
        if (next in STAGE_LABELS) setStage(next);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const analyze = useCallback(async () => {
    if (!job) return;
    setStatus("analyzing");
    setStage("extracting");
    setError(null);
    setDegraded(null);

    try {
      const result = await send({
        type: "ANALYZE_JOB",
        payload: { job, useAI: true },
      });
      setJob(result.job);
      setAnalysis(result.analysis);
      const aiError = (result as { aiError?: { message: string } | null })
        .aiError;
      if (aiError) {
        setDegraded(`${aiError.message} Showing local analysis only.`);
      }
      setStatus("analyzed");
    } catch (err) {
      setError(err instanceof MessageError ? err.message : "Analysis failed.");
      setStatus("detected");
    }
  }, [job]);

  const selectManually = useCallback(async () => {
    if (!tabId) return;
    try {
      await sendToTab(tabId, { type: "START_MANUAL_SELECTION" });

      window.close();
    } catch (err) {
      setError(
        err instanceof MessageError
          ? err.message
          : "Could not start selection.",
      );
    }
  }, [tabId]);

  const redetect = useCallback(async () => {
    if (!tabId) return;
    setStatus("loading");
    try {
      const detection = await sendToTab(tabId, {
        type: "EXTRACT_JOB",
        payload: { force: true },
      });
      if (detection.ok && detection.job?.description) {
        setJob(detection.job as JobPosting);
        setStatus("detected");
        setError(null);
      } else {
        setStatus("no-job");
        setError(detection.reason || "Still no job description found.");
      }
    } catch (err) {
      setError(
        err instanceof MessageError
          ? err.message
          : "Could not re-read the page.",
      );
      setStatus("no-job");
    }
  }, [tabId]);

  return {
    status,
    state,
    settings,
    job,
    analysis,
    stage,
    error,
    degraded,
    tabId,
    analyze,
    selectManually,
    redetect,
    refresh: load,
    setAnalysis,
  };
}
