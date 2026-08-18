import { useCallback, useEffect, useState } from "react";
import type { UserSettings } from "@job-ai/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Skeleton,
  Switch,
} from "@job-ai/ui";
import {
  Check,
  FileText,
  KeyRound,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { MessageError, send } from "../lib/messaging.ts";
import { applyTheme } from "../lib/theme.ts";
import { ResumeUpload } from "../components/ResumeUpload.tsx";
import { ProviderSetup } from "../components/ProviderSetup.tsx";

const STEPS = ["welcome", "provider", "resume", "privacy", "ready"] as const;
type Step = (typeof STEPS)[number];

const STEP_META: Record<Step, { title: string; icon: typeof Sparkles }> = {
  welcome: { title: "Welcome", icon: Sparkles },
  resume: { title: "Your resume", icon: FileText },
  provider: { title: "AI provider", icon: KeyRound },
  privacy: { title: "Privacy", icon: ShieldCheck },
  ready: { title: "Ready", icon: Rocket },
};

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [resumeLabel, setResumeLabel] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [next, state] = await Promise.all([
        send({ type: "GET_SETTINGS" }),
        send({ type: "GET_STATE" }),
      ]);
      setSettings(next);
      setResumeLabel(state.resumeLabel);
      applyTheme(next.ui.theme);
    } catch (err) {
      setLoadError(
        err instanceof MessageError
          ? err.message
          : "Could not reach the extension background service.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const index = STEPS.indexOf(step);

  const finish = async () => {
    const next = await send({
      type: "UPDATE_SETTINGS",
      payload: { onboardingCompletedAt: new Date().toISOString() },
    });
    setSettings(next);
    setStep("ready");
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-lg font-semibold text-fg">
          Setup couldn&rsquo;t start
        </h1>
        <Alert tone="danger" className="mt-3">
          {loadError}
        </Alert>
        <p className="mt-3 text-xs text-fg-muted">
          This usually means the extension was just reloaded. Reloading this
          page normally fixes it.
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void load()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <nav
          aria-label="Setup progress"
          className="mb-8 flex items-center gap-1"
        >
          {STEPS.map((s, i) => {
            const Icon = STEP_META[s].icon;
            const done = i < index;
            const active = i === index;
            return (
              <div key={s} className="flex flex-1 items-center gap-1">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                    active
                      ? "bg-brand text-brand-fg"
                      : done
                        ? "bg-strong-subtle text-strong"
                        : "bg-surface-muted text-fg-subtle"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 ${done ? "bg-strong" : "bg-border"}`}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {step === "welcome" && (
          <StepShell
            title="Your AI career copilot, inside every job listing"
            description="Open any job posting and see how your resume actually lines up — what matches, what's missing, and what to do about it."
          >
            <ul className="space-y-3">
              {[
                [
                  "See your match",
                  "An explainable score with the reasoning behind every component.",
                ],
                [
                  "Find the real gaps",
                  "Strong, partial and missing skills — partial matches are never dressed up as full ones.",
                ],
                [
                  "Tailor honestly",
                  "Rewrites drawn only from what your resume already says. Nothing is invented.",
                ],
                [
                  "Prepare and track",
                  "Interview prep per role, plus a tracker you can export to Excel.",
                ],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-strong" />
                  <span>
                    <span className="block text-sm font-medium text-fg">
                      {title}
                    </span>
                    <span className="block text-xs text-fg-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button className="mt-6" onClick={() => setStep("provider")}>
              Get started
            </Button>
          </StepShell>
        )}

        {step === "resume" && (
          <StepShell
            title="Upload your resume"
            description="This is the only required step. Everything is analyzed against this."
          >
            <ResumeUpload
              onUploaded={(label) => {
                setResumeLabel(label);
                setStep("privacy");
              }}
            />
            {resumeLabel && (
              <Button
                variant="ghost"
                className="mt-4"
                onClick={() => setStep("privacy")}
              >
                Continue with current resume
              </Button>
            )}
          </StepShell>
        )}

        {step === "provider" && (
          <StepShell
            title="Choose an AI provider"
            description="Bring your own key. Optional — match scoring, skill gaps and ATS analysis all work without one."
          >
            <ProviderSetup settings={settings} onSaved={setSettings} />

            <div className="mt-6 border-t border-border pt-4">
              <Switch
                checked={settings.demoMode}
                label="Try demo mode instead"
                description="Explore every feature using clearly-labelled sample data. No API calls, no key needed."
                onChange={async (demoMode) => {
                  setSettings(
                    await send({
                      type: "UPDATE_SETTINGS",
                      payload: { demoMode },
                    }),
                  );
                }}
              />
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={() => setStep("resume")}>Continue</Button>
              <Button variant="ghost" onClick={() => setStep("resume")}>
                Skip for now
              </Button>
            </div>
          </StepShell>
        )}

        {step === "privacy" && (
          <StepShell
            title="Where your data lives"
            description="You're in guest mode. Nothing needs an account, and nothing is sent to us."
          >
            <div className="space-y-3">
              <Card>
                <CardBody>
                  <p className="text-sm font-medium text-fg">
                    Stored on this device only
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                    Your resume text, job analyses, application tracker and API
                    key live in this browser&rsquo;s extension storage. They are
                    not synced and not sent to our servers. Clearing the
                    extension&rsquo;s data removes them permanently.
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <p className="text-sm font-medium text-fg">
                    What reaches your AI provider
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                    When you run analysis, tailoring, a cover letter or
                    interview prep, the job description and your resume text are
                    sent to the provider you chose, using your key. Nothing is
                    sent when you are just browsing.
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardBody className="space-y-3">
                  <Switch
                    checked={settings.privacy.redactContactInfo}
                    label="Redact contact details before sending"
                    description="Replaces email addresses and phone numbers with placeholders in AI requests."
                    onChange={async (redactContactInfo) => {
                      setSettings(
                        await send({
                          type: "UPDATE_SETTINGS",
                          payload: {
                            privacy: { ...settings.privacy, redactContactInfo },
                          },
                        }),
                      );
                    }}
                  />
                  <Switch
                    checked={settings.privacy.storeJobSnapshots}
                    label="Keep a copy of each job description"
                    description="Lets your tracker stay useful after a posting is taken down."
                    onChange={async (storeJobSnapshots) => {
                      setSettings(
                        await send({
                          type: "UPDATE_SETTINGS",
                          payload: {
                            privacy: { ...settings.privacy, storeJobSnapshots },
                          },
                        }),
                      );
                    }}
                  />
                </CardBody>
              </Card>

              <Alert tone="neutral">
                We do not sell resume data and do not use it to train models.
                You can export or delete everything at any time from Settings.
              </Alert>
            </div>

            <Button className="mt-6" onClick={() => void finish()}>
              Finish setup
            </Button>
          </StepShell>
        )}

        {step === "ready" && (
          <StepShell
            title="You're set up"
            description="Open any job listing and click the extension icon to analyze your match."
          >
            <div className="space-y-3">
              <Card>
                <CardBody className="flex items-start gap-3">
                  <Badge tone="strong">1</Badge>
                  <p className="text-xs leading-relaxed text-fg-muted">
                    Browse to a job posting on any careers site — Greenhouse,
                    Lever, Workday, LinkedIn, Ashby or a company&rsquo;s own
                    page.
                  </p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-start gap-3">
                  <Badge tone="strong">2</Badge>
                  <p className="text-xs leading-relaxed text-fg-muted">
                    Click the extension icon. If the description isn&rsquo;t
                    detected automatically, use &ldquo;Select it
                    manually&rdquo;.
                  </p>
                </CardBody>
              </Card>
              <Card>
                <CardBody className="flex items-start gap-3">
                  <Badge tone="strong">3</Badge>
                  <p className="text-xs leading-relaxed text-fg-muted">
                    Analyze, tailor, save to your tracker, and export to Excel
                    whenever you want.
                  </p>
                </CardBody>
              </Card>

              <Alert tone="brand" title="Want it on more than one device?">
                Creating a free account later syncs your resume versions,
                tracker and analytics to the web dashboard. Everything keeps
                working without one.
              </Alert>
            </div>

            <div className="mt-6 flex gap-2">
              <Button onClick={() => window.close()}>Done</Button>
              <Button
                variant="outline"
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                Open settings
              </Button>
            </div>
          </StepShell>
        )}
      </div>
    </div>
  );
}

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
