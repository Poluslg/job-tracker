import { useState } from "react";
import { Alert, Button, EmptyState, Skeleton, useToast } from "@job-ai/ui";
import { STAGE_LABELS } from "@job-ai/types";
import {
  FileText,
  Settings,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useJobFlow } from "./useJobFlow.ts";
import { AnalysisView } from "./views/AnalysisView.tsx";
import { TrackerView } from "./views/TrackerView.tsx";
import { Header } from "./views/Header.tsx";

export type PopupTab = "analyze" | "tracker";

export function App() {
  const flow = useJobFlow();
  const [tab, setTab] = useState<PopupTab>("analyze");
  const { toast } = useToast();

  const openOptions = () => chrome.runtime.openOptionsPage();
  const openOnboarding = () =>
    void chrome.tabs.create({
      url: chrome.runtime.getURL("src/onboarding/index.html"),
    });

  return (
    <div className="flex min-h-[520px] w-[400px] flex-col bg-bg text-fg">
      <Header
        tab={tab}
        onTabChange={setTab}
        state={flow.state}
        onOpenSettings={openOptions}
        applicationCount={flow.state?.applicationCount ?? 0}
      />

      <main className="flex-1 overflow-y-auto">
        {tab === "tracker" ? (
          <TrackerView
            onError={(m) => toast(m, "error")}
            onDone={(m) => toast(m, "success")}
          />
        ) : (
          <AnalyzeTab
            flow={flow}
            onOpenOptions={openOptions}
            onOpenOnboarding={openOnboarding}
          />
        )}
      </main>

      {flow.state?.demoMode && (
        <div className="border-t border-warn/30 bg-warn-subtle px-4 py-1.5 text-center text-[11px] text-warn">
          Demo mode — results are sample data, not analysis of your resume.
        </div>
      )}
    </div>
  );
}

function AnalyzeTab({
  flow,
  onOpenOptions,
  onOpenOnboarding,
}: {
  flow: ReturnType<typeof useJobFlow>;
  onOpenOptions: () => void;
  onOpenOnboarding: () => void;
}) {
  switch (flow.status) {
    case "loading":
      return <LoadingSkeleton />;

    case "no-resume":
      return (
        <EmptyState
          icon={<FileText className="h-8 w-8" strokeWidth={1.5} />}
          title="Upload your resume to start analyzing jobs"
          description="It stays on this device. Nothing is uploaded to us, and you don't need an account."
          action={<Button onClick={onOpenOnboarding}>Get started</Button>}
        />
      );

    case "restricted":
      return (
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" strokeWidth={1.5} />}
          title="This page can't be read"
          description="Chrome blocks extensions on browser pages, the Web Store and PDF viewers. Open a job listing on a normal website and try again."
          action={
            <Button variant="outline" onClick={() => void flow.refresh()}>
              Check again
            </Button>
          }
        />
      );

    case "no-job":
      return (
        <div className="p-4">
          <EmptyState
            icon={<Sparkles className="h-8 w-8" strokeWidth={1.5} />}
            title="No job description detected"
            description={
              flow.error ?? "We could not find a posting on this page."
            }
          />
          <div className="space-y-2 px-2">
            <Button block onClick={() => void flow.selectManually()}>
              Select it manually
            </Button>
            <Button
              block
              variant="outline"
              onClick={() => void flow.redetect()}
            >
              Try detecting again
            </Button>
            <p className="pt-1 text-center text-[11px] leading-relaxed text-fg-subtle">
              Manual selection closes this popup so you can highlight the
              description on the page.
            </p>
          </div>
        </div>
      );

    case "detected":
    case "analyzing":
    case "analyzed":
      return (
        <div className="p-4">
          {flow.error && (
            <Alert tone="danger" className="mb-3">
              {flow.error}
            </Alert>
          )}
          {flow.degraded && (
            <Alert tone="warn" title="AI step unavailable" className="mb-3">
              {flow.degraded}
            </Alert>
          )}

          {flow.status === "analyzing" ? (
            <AnalyzingState label={STAGE_LABELS[flow.stage]} />
          ) : (
            <AnalysisView flow={flow} onOpenOptions={onOpenOptions} />
          )}
        </div>
      );
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

function AnalyzingState({ label }: { label: string }) {
  const stages = Object.values(STAGE_LABELS).filter((s) => s !== "Done");
  const currentIndex = stages.indexOf(label);

  return (
    <div className="py-6">
      <div className="flex justify-center mb-6">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
          <div className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
          <FileText className="h-6 w-6 text-brand animate-pulse" />
        </div>
      </div>

      <div className="mx-auto max-w-xs space-y-3 px-4">
        {stages.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-3 transition-opacity duration-500 ${i <= currentIndex ? "opacity-100" : "opacity-30"}`}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              {i < currentIndex ? (
                <CheckCircle2 className="h-4 w-4 text-brand" />
              ) : i === currentIndex ? (
                <div className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-border"></div>
              )}
            </div>
            <span
              className={`text-sm ${i === currentIndex ? "text-fg font-medium animate-pulse" : "text-fg-muted"}`}
            >
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { Settings };
