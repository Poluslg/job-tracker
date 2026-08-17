import { useState } from 'react';
import { Alert, Button, EmptyState, Skeleton, useToast } from '@job-ai/ui';
import { STAGE_LABELS } from '@job-ai/types';
import { FileText, Settings, ShieldAlert, Sparkles } from 'lucide-react';
import { useJobFlow } from './useJobFlow.ts';
import { AnalysisView } from './views/AnalysisView.tsx';
import { TrackerView } from './views/TrackerView.tsx';
import { Header } from './views/Header.tsx';

export type PopupTab = 'analyze' | 'tracker';

export function App() {
  const flow = useJobFlow();
  const [tab, setTab] = useState<PopupTab>('analyze');
  const { toast } = useToast();

  const openOptions = () => chrome.runtime.openOptionsPage();
  const openOnboarding = () =>
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });

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
        {tab === 'tracker' ? (
          <TrackerView onError={(m) => toast(m, 'error')} onDone={(m) => toast(m, 'success')} />
        ) : (
          <AnalyzeTab flow={flow} onOpenOptions={openOptions} onOpenOnboarding={openOnboarding} />
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
    case 'loading':
      return <LoadingSkeleton />;

    case 'no-resume':
      return (
        <EmptyState
          icon={<FileText className="h-8 w-8" strokeWidth={1.5} />}
          title="Upload your resume to start analyzing jobs"
          description="It stays on this device. Nothing is uploaded to us, and you don't need an account."
          action={<Button onClick={onOpenOnboarding}>Get started</Button>}
        />
      );

    case 'restricted':
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

    case 'no-job':
      return (
        <div className="p-4">
          <EmptyState
            icon={<Sparkles className="h-8 w-8" strokeWidth={1.5} />}
            title="No job description detected"
            description={flow.error ?? 'We could not find a posting on this page.'}
          />
          <div className="space-y-2 px-2">
            <Button block onClick={() => void flow.selectManually()}>
              Select it manually
            </Button>
            <Button block variant="outline" onClick={() => void flow.redetect()}>
              Try detecting again
            </Button>
            <p className="pt-1 text-center text-[11px] leading-relaxed text-fg-subtle">
              Manual selection closes this popup so you can highlight the description on the page.
            </p>
          </div>
        </div>
      );

    case 'detected':
    case 'analyzing':
    case 'analyzed':
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

          {flow.status === 'analyzing' ? (
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
  const stages = Object.values(STAGE_LABELS).filter((s) => s !== 'Done');
  const currentIndex = stages.indexOf(label);

  return (
    <div className="py-6">
      <ul className="mx-auto max-w-xs space-y-2">
        {stages.map((s, i) => {
          const done = currentIndex > i;
          const active = currentIndex === i;
          return (
            <li
              key={s}
              className={
                active ? 'text-sm font-medium text-fg' : done ? 'text-sm text-fg-subtle' : 'text-sm text-fg-subtle/60'
              }
            >
              <span className="mr-2 inline-block w-4 text-center">{done ? '✓' : active ? '›' : '·'}</span>
              {s}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 space-y-2 px-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}

export { Settings };
