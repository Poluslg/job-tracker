import { useEffect, useState } from "react";
import type { ExtensionState, UserSettings, Resume } from "@job-ai/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Select,
  Skeleton,
  Switch,
  Tabs,
  TabPanel,
  useToast,
} from "@job-ai/ui";
import { Download, Trash2 } from "lucide-react";
import { send } from "../lib/messaging.ts";
import { applyTheme } from "../lib/theme.ts";
import { downloadDataUrl, downloadText } from "../lib/download.ts";
import { ResumeUpload } from "../components/ResumeUpload.tsx";
import { ProviderSetup } from "../components/ProviderSetup.tsx";
import { ProfileEditor } from "../components/ProfileEditor.tsx";

const WEB_DASHBOARD_URL = "http://localhost:3000";

export function Options() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [state, setState] = useState<ExtensionState | null>(null);
  const [resume, setResume] = useState<Resume | null>(null);
  const [tab, setTab] = useState("resume");
  const [isUploadingNew, setIsUploadingNew] = useState(false);
  const { toast } = useToast();

  const reload = async () => {
    const [nextSettings, nextState, nextResume] = await Promise.all([
      send({ type: "GET_SETTINGS" }),
      send({ type: "GET_STATE" }),
      send({ type: "GET_RESUME" }),
    ]);
    setSettings(nextSettings);
    setState(nextState);
    setResume(nextResume.resume);
    applyTheme(nextSettings.ui.theme);
  };

  useEffect(() => {
    void reload();
  }, []);

  const patch = async (payload: Partial<UserSettings>) => {
    const next = await send({ type: "UPDATE_SETTINGS", payload });
    setSettings(next);
    applyTheme(next.ui.theme);
    return next;
  };

  if (!settings || !state) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-fg">Settings</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {state.authMode === "guest"
              ? "Guest mode — everything is stored on this device only."
              : "Signed in — your data syncs to the web dashboard."}
          </p>
        </header>

        <Tabs
          active={tab}
          onChange={setTab}
          items={[
            { id: "resume", label: "Resume" },
            { id: "ai", label: "AI provider" },
            // { id: "scoring", label: "Scoring" },
            { id: "appearance", label: "Appearance" },
            { id: "privacy", label: "Privacy & data" },
            { id: "account", label: "Account" },
          ]}
        />

        <div className="pt-6">
          <TabPanel id="resume" active={tab}>
            {!resume || isUploadingNew ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-fg">
                      {resume ? "Upload new resume" : "Resume"}
                    </h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      Upload your resume to start analyzing jobs and generating
                      tailored applications.
                    </p>
                  </div>
                  {resume && (
                    <Button
                      variant="ghost"
                      onClick={() => setIsUploadingNew(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>

                <Card>
                  <CardBody className="space-y-6">
                    <ResumeUpload
                      onUploaded={(label) => {
                        toast(`Saved "${label}".`, "success");
                        setIsUploadingNew(false);
                        void reload();
                      }}
                    />
                  </CardBody>
                </Card>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-fg">Resume</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      Correct anything the parser got wrong — everything
                      downstream reads these fields.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {resume.needsReview ? (
                      <Badge tone="warn">Needs review</Badge>
                    ) : (
                      <Badge tone="strong">Reviewed</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsUploadingNew(true)}
                    >
                      Upload new
                    </Button>
                  </div>
                </div>

                {resume.needsReview && (
                  <Alert tone="warn" title="Check the parsed fields">
                    Resumes vary wildly in layout, so the parser is best-effort.
                    Fix anything that looks wrong before relying on a match
                    score.
                  </Alert>
                )}

                <ProfileEditor
                  resume={resume}
                  onSaved={(next) => {
                    setResume(next);
                    toast("Profile saved.", "success");
                  }}
                  onError={(err) => toast(err, "error")}
                />
              </div>
            )}
          </TabPanel>

          <TabPanel id="ai" active={tab}>
            <Card>
              <CardHeader>
                <CardTitle>AI provider</CardTitle>
              </CardHeader>
              <CardBody className="space-y-5">
                <ProviderSetup
                  settings={settings}
                  onSaved={(next) => {
                    setSettings(next);
                    toast("Provider settings saved.", "success");
                    void reload();
                  }}
                />
                <div className="border-t border-border pt-4">
                  <Switch
                    checked={settings.demoMode}
                    label="Demo mode"
                    description="Use bundled sample data instead of calling a provider. Results are clearly labelled as samples."
                    onChange={async (demoMode) => {
                      await patch({ demoMode });
                      toast(
                        demoMode ? "Demo mode on." : "Demo mode off.",
                        "success",
                      );
                      void reload();
                    }}
                  />
                </div>
              </CardBody>
            </Card>
          </TabPanel>

          {/*
          <TabPanel id="scoring" active={tab}>
            <ScoringSettings
              settings={settings}
              onChange={patch}
              onSaved={() => toast("Weights updated.", "success")}
            />
          </TabPanel>
          */}

          <TabPanel id="appearance" active={tab}>
            <Card>
              <CardHeader>
                <CardTitle>Appearance & behaviour</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="max-w-xs">
                  <label
                    htmlFor="theme"
                    className="mb-1.5 block text-xs font-medium text-fg-muted"
                  >
                    Theme
                  </label>
                  <Select
                    id="theme"
                    value={settings.ui.theme}
                    onChange={(e) =>
                      void patch({
                        ui: {
                          ...settings.ui,
                          theme: e.target.value as UserSettings["ui"]["theme"],
                        },
                      })
                    }
                  >
                    <option value="system">Match system</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </Select>
                </div>

                <Switch
                  checked={settings.ui.showFloatingButton}
                  label="Show the floating button on job pages"
                  description="A small button appears in the corner when a posting is detected."
                  onChange={(showFloatingButton) =>
                    void patch({ ui: { ...settings.ui, showFloatingButton } })
                  }
                />

                <Switch
                  checked={settings.ui.autoAnalyze}
                  label="Analyze automatically when a job is detected"
                  description="Off by default — automatic analysis spends tokens on your provider account without you asking."
                  onChange={(autoAnalyze) =>
                    void patch({ ui: { ...settings.ui, autoAnalyze } })
                  }
                />
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel id="privacy" active={tab}>
            <PrivacySettings
              settings={settings}
              onChange={patch}
              onToast={toast}
              onReload={reload}
            />
          </TabPanel>

          <TabPanel id="account" active={tab}>
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-fg-muted">
                  You&rsquo;re using guest mode. Everything works without an
                  account — a free account only adds cross-device sync and the
                  web dashboard.
                </p>
                <ul className="space-y-1.5 text-xs text-fg-muted">
                  <li>
                    • Sync your resume versions and tracker across devices
                  </li>
                  <li>
                    • Full application table, notes, contacts and interview
                    scheduling
                  </li>
                  <li>
                    • Analytics: funnel, response rate and repeated skill gaps
                  </li>
                </ul>
                <Alert tone="neutral">
                  Local data stays local until you explicitly turn sync on.
                  Signing in never uploads anything on its own.
                </Alert>
                {/* <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      void chrome.tabs.create({
                        url: `${WEB_DASHBOARD_URL}/login`,
                      })
                    }
                  >
                    Create a free account
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void chrome.tabs.create({ url: WEB_DASHBOARD_URL })
                    }
                  >
                    Open dashboard
                  </Button>
                </div> */}
              </CardBody>
            </Card>
          </TabPanel>
        </div>
      </div>
    </div>
  );
}

/*
function ScoringSettings({
  settings,
  onChange,
  onSaved,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => Promise<UserSettings>;
  onSaved: () => void;
}) {
  const [weights, setWeights] = useState(settings.scoring);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const LABELS: Record<keyof typeof weights, string> = {
    requiredSkills: "Required skills",
    preferredSkills: "Preferred skills",
    experience: "Experience",
    responsibilities: "Responsibilities",
    keywords: "Keyword / ATS coverage",
    education: "Education & certifications",
    domain: "Domain alignment",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring weights</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs leading-relaxed text-fg-muted">
          The match score is computed locally from these weights — no model
          produces the number, which is why it is reproducible and explainable.
          Weights are normalised, so they need not sum to exactly 100%.
        </p>

        {(Object.keys(LABELS) as Array<keyof typeof weights>).map((key) => (
          <div key={key}>
            <div className="flex items-baseline justify-between">
              <label htmlFor={`w-${key}`} className="text-xs text-fg">
                {LABELS[key]}
              </label>
              <span className="text-xs tabular-nums text-fg-muted">
                {Math.round((weights[key] / (total || 1)) * 100)}%
              </span>
            </div>
            <input
              id={`w-${key}`}
              type="range"
              min={0}
              max={50}
              value={Math.round(weights[key] * 100)}
              onChange={(e) =>
                setWeights({ ...weights, [key]: Number(e.target.value) / 100 })
              }
              className="mt-1 w-full accent-[var(--color-brand)]"
            />
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={async () => {
              await onChange({ scoring: weights });
              onSaved();
            }}
          >
            Save weights
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              const defaults = {
                requiredSkills: 0.3,
                preferredSkills: 0.15,
                experience: 0.2,
                responsibilities: 0.15,
                keywords: 0.1,
                education: 0.05,
                domain: 0.05,
              };
              setWeights(defaults);
              await onChange({ scoring: defaults });
              onSaved();
            }}
          >
            Reset to defaults
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
*/

function PrivacySettings({
  settings,
  onChange,
  onToast,
  onReload,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => Promise<UserSettings>;
  onToast: (message: string, tone: "success" | "error" | "info") => void;
  onReload: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<
    "all" | "applications" | "resumes" | null
  >(null);

  const clear = async (scope: "all" | "applications" | "resumes") => {
    await send({ type: "CLEAR_LOCAL_DATA", payload: { scope } });
    setConfirming(null);
    onToast("Deleted.", "success");
    await onReload();
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>What gets sent where</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Switch
            checked={settings.privacy.redactContactInfo}
            label="Redact contact details in AI requests"
            description="Replaces email addresses and phone numbers with placeholders before your resume text is sent to a provider."
            onChange={(redactContactInfo) =>
              void onChange({
                privacy: { ...settings.privacy, redactContactInfo },
              })
            }
          />
          <Switch
            checked={settings.privacy.storeJobSnapshots}
            label="Store a copy of each job description"
            description="Keeps your tracker readable after a posting is removed. Uses more local storage."
            onChange={(storeJobSnapshots) =>
              void onChange({
                privacy: { ...settings.privacy, storeJobSnapshots },
              })
            }
          />
          <Switch
            checked={settings.privacy.shareAnonymousUsage}
            label="Share anonymous usage counts"
            description="Off by default. Never includes resume, job or analysis content. We do not use your data to train models."
            onChange={(shareAnonymousUsage) =>
              void onChange({
                privacy: { ...settings.privacy, shareAnonymousUsage },
              })
            }
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const file = await send({
                  type: "EXPORT_TRACKER",
                  payload: { format: "xlsx" },
                });
                await downloadDataUrl(file.dataUrl, file.fileName);
                onToast(`Exported ${file.fileName}`, "success");
              } catch (err) {
                onToast(
                  err instanceof Error ? err.message : "Export failed.",
                  "error",
                );
              }
            }}
          >
            <Download className="h-4 w-4" /> Tracker as Excel
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const file = await send({
                  type: "EXPORT_TRACKER",
                  payload: { format: "csv" },
                });
                await downloadDataUrl(file.dataUrl, file.fileName);
                onToast(`Exported ${file.fileName}`, "success");
              } catch (err) {
                onToast(
                  err instanceof Error ? err.message : "Export failed.",
                  "error",
                );
              }
            }}
          >
            <Download className="h-4 w-4" /> Tracker as CSV
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              const applications = await send({ type: "LIST_APPLICATIONS" });
              downloadText(
                JSON.stringify(applications, null, 2),
                "career-copilot-data.json",
                "application/json",
              );
              onToast("Exported your data as JSON.", "success");
            }}
          >
            Everything as JSON
          </Button>
        </CardBody>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle>Delete data</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-fg-muted">
            Deletion is immediate and cannot be undone. Export first if you
            might want the data back.
          </p>

          {(
            [
              [
                "applications",
                "Delete tracker & saved jobs",
                "Removes every application, job, analysis, cover letter and interview prep.",
              ],
              [
                "resumes",
                "Delete resumes & versions",
                "Removes your uploaded resume text and all tailored versions.",
              ],
              [
                "all",
                "Delete everything",
                "Clears all local extension data, including your API key and settings.",
              ],
            ] as const
          ).map(([scope, label, description]) => (
            <div key={scope} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-fg">{label}</p>
              <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
              {confirming === scope ? (
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void clear(scope)}
                  >
                    Yes, delete permanently
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setConfirming(scope)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {label}
                </Button>
              )}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
