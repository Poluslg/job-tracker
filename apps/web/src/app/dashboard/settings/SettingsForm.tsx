"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AIProviderId, UserSettings } from "@job-ai/types";
import { PROVIDER_META, SELECTABLE_PROVIDERS } from "@job-ai/ai";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Switch,
  Tabs,
  TabPanel,
  useToast,
} from "@job-ai/ui";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { del, errorMessage, patch } from "@/lib/api";
import { applyTheme } from "@/lib/theme";
import { PageHeader } from "@/components/PageHeader";

export function SettingsForm({
  initialSettings,
  hasApiKey,
  email,
}: {
  initialSettings: UserSettings;
  hasApiKey: boolean;
  email: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [keyStored, setKeyStored] = useState(hasApiKey);
  const [apiKey, setApiKey] = useState("");
  const [tab, setTab] = useState("ai");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async (body: Partial<UserSettings>, message = "Saved.") => {
    setBusy(true);
    try {
      const result = await patch<{ settings: UserSettings }>(
        "/api/settings",
        body,
      );
      setSettings(result.settings);
      toast(message, "success");
      return result.settings;
    } catch (err) {
      toast(errorMessage(err, "Could not save that."), "error");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const meta =
    PROVIDER_META[
      settings.ai.provider === "mock" ? "openai" : settings.ai.provider
    ];

  return (
    <>
      <PageHeader title="Settings" description={email} />

      <Tabs
        active={tab}
        onChange={setTab}
        items={[
          { id: "ai", label: "AI provider" },
          { id: "appearance", label: "Appearance" },
          { id: "privacy", label: "Privacy & data" },
          { id: "account", label: "Account" },
        ]}
      />

      <div className="pt-6">
        <TabPanel id="ai" active={tab}>
          <Card>
            <CardBody className="max-w-xl space-y-4">
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Select
                  id="provider"
                  value={
                    settings.ai.provider === "mock"
                      ? "openai"
                      : settings.ai.provider
                  }
                  onChange={(e) => {
                    const provider = e.target.value as AIProviderId;
                    void save(
                      {
                        ai: {
                          ...settings.ai,
                          provider,
                          model: PROVIDER_META[provider].defaultModel,
                        },
                      },
                      "Provider updated.",
                    );
                  }}
                >
                  {SELECTABLE_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={settings.ai.model || meta.defaultModel}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      ai: { ...settings.ai, model: e.target.value },
                    })
                  }
                  onBlur={() =>
                    void save({ ai: settings.ai }, "Model updated.")
                  }
                  placeholder={"e.g. " + meta.defaultModel}
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-key" className="mb-0">
                    API key
                  </Label>
                  {keyStored && (
                    <Badge tone="strong" size="sm">
                      Key saved
                    </Badge>
                  )}
                </div>
                <Input
                  id="api-key"
                  type="password"
                  className="mt-1.5"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    keyStored
                      ? "Saved — enter a new key to replace it"
                      : "Paste your key"
                  }
                />
                <a
                  href={meta.keyUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-brand underline"
                >
                  Get a {meta.name} key <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <Alert tone="warn" title="Bring your own key">
                Requests are billed to your own provider account and you are
                responsible for those costs. Your key is stored against your
                account and used only to call the provider you selected — it is
                never sent to a third party or included in exports.
              </Alert>

              <div className="flex gap-2">
                <Button
                  loading={busy}
                  disabled={!apiKey}
                  onClick={async () => {
                    const next = await save(
                      { ai: { ...settings.ai, apiKey } },
                      "API key saved.",
                    );
                    if (next) {
                      setApiKey("");
                      setKeyStored(true);
                    }
                  }}
                >
                  Save key
                </Button>
                {keyStored && (
                  <Button
                    variant="ghost"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await del("/api/settings");
                        setKeyStored(false);
                        setApiKey("");
                        toast("API key removed.", "success");
                      } catch (err) {
                        toast(
                          errorMessage(err, "Could not remove the key."),
                          "error",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Remove key
                  </Button>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <Switch
                  checked={settings.demoMode}
                  label="Demo mode"
                  description="Use bundled sample responses instead of calling a provider. Output is clearly labelled as sample data."
                  onChange={(demoMode) =>
                    void save(
                      { demoMode },
                      demoMode ? "Demo mode on." : "Demo mode off.",
                    )
                  }
                />
              </div>
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel id="appearance" active={tab}>
          <Card>
            <CardBody className="max-w-xs">
              <Label htmlFor="theme">Theme</Label>
              <Select
                id="theme"
                value={settings.ui.theme}
                onChange={(e) => {
                  const theme = e.target.value as UserSettings["ui"]["theme"];
                  applyTheme(theme);
                  void save(
                    { ui: { ...settings.ui, theme } },
                    "Theme updated.",
                  );
                }}
              >
                <option value="system">Match system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel id="privacy" active={tab}>
          <div className="max-w-2xl space-y-4">
            <Card>
              <CardBody className="space-y-4">
                <h2 className="text-sm font-semibold">What gets sent where</h2>
                <p className="text-xs leading-relaxed text-fg-muted">
                  Your resume and job descriptions are stored against your
                  account so they can sync across devices. They are sent to an
                  AI provider only when you run a feature that needs one, using
                  the key you configured. We do not sell resume data and do not
                  use it to train models.
                </p>
                <Switch
                  checked={settings.privacy.redactContactInfo}
                  label="Redact contact details in AI requests"
                  description="Replaces email addresses and phone numbers with placeholders before your resume text is sent."
                  onChange={(redactContactInfo) =>
                    void save({
                      privacy: { ...settings.privacy, redactContactInfo },
                    })
                  }
                />
                <Switch
                  checked={settings.privacy.storeJobSnapshots}
                  label="Store a copy of each job description"
                  description="Keeps your tracker readable after a posting is taken down."
                  onChange={(storeJobSnapshots) =>
                    void save({
                      privacy: { ...settings.privacy, storeJobSnapshots },
                    })
                  }
                />
                <Switch
                  checked={settings.privacy.shareAnonymousUsage}
                  label="Share anonymous usage counts"
                  description="Off by default. Never includes resume, job or analysis content."
                  onChange={(shareAnonymousUsage) =>
                    void save({
                      privacy: { ...settings.privacy, shareAnonymousUsage },
                    })
                  }
                />
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="mb-3 text-sm font-semibold">Export your data</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      (window.location.href = "/api/export?format=xlsx")
                    }
                  >
                    <Download className="h-4 w-4" /> Tracker as Excel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      (window.location.href = "/api/export?format=csv")
                    }
                  >
                    <Download className="h-4 w-4" /> Tracker as CSV
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="account" active={tab}>
          <Card className="max-w-2xl border-danger/30">
            <CardBody className="space-y-3">
              <h2 className="text-sm font-semibold">Delete your account</h2>
              <p className="text-xs leading-relaxed text-fg-muted">
                This permanently removes your account and every resume, job,
                analysis, application, cover letter and interview prep attached
                to it. There is no recovery window. Export your tracker first if
                you might want it.
              </p>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await del("/api/account");
                        router.push("/login");
                        router.refresh();
                      } catch (err) {
                        toast(
                          errorMessage(err, "Could not delete your account."),
                          "error",
                        );
                        setBusy(false);
                      }
                    }}
                  >
                    Yes, delete my account permanently
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete account
                </Button>
              )}
            </CardBody>
          </Card>
        </TabPanel>
      </div>
    </>
  );
}
