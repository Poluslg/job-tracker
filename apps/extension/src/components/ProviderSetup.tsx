import { useState } from "react";
import type { AIProviderId, UserSettings } from "@job-ai/types";
import { PROVIDER_META, SELECTABLE_PROVIDERS } from "@job-ai/ai";
import { Alert, Badge, Button, Input, Label, Select } from "@job-ai/ui";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { MessageError, send } from "../lib/messaging.ts";

export function ProviderSetup({
  settings,
  onSaved,
}: {
  settings: UserSettings;
  onSaved: (next: UserSettings) => void;
}) {
  const [provider, setProvider] = useState<AIProviderId>(
    settings.ai.provider === "mock" ? "openai" : settings.ai.provider,
  );
  const [model, setModel] = useState(
    settings.ai.model || PROVIDER_META[provider].defaultModel,
  );
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const meta = PROVIDER_META[provider];
  const hasStoredKey = settings.ai.apiKey.length > 0;

  const changeProvider = (next: AIProviderId) => {
    setProvider(next);
    setModel(PROVIDER_META[next].defaultModel);
    setResult(null);
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const response = await send({
        type: "TEST_AI_CONNECTION",
        payload: { provider, apiKey: apiKey || settings.ai.apiKey, model },
      });
      setResult(response);
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof MessageError ? err.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const next = await send({
        type: "UPDATE_SETTINGS",
        payload: {
          ai: {
            ...settings.ai,
            provider,
            model,

            apiKey: apiKey || settings.ai.apiKey,
          },
          demoMode: false,
        },
      });
      setApiKey("");
      onSaved(next);
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    setSaving(true);
    try {
      await send({ type: "CLEAR_LOCAL_DATA", payload: { scope: "ai-key" } });
      const next = await send({ type: "GET_SETTINGS" });
      setApiKey("");
      setResult(null);
      onSaved(next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="provider">AI provider</Label>
        <Select
          id="provider"
          value={provider}
          onChange={(e) => changeProvider(e.target.value as AIProviderId)}
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
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={
            provider === "openrouter"
              ? "vendor/model"
              : "e.g. " + meta.defaultModel
          }
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="api-key" className="mb-0">
            API key
          </Label>
          {hasStoredKey && (
            <Badge tone="strong" size="sm">
              Key saved
            </Badge>
          )}
        </div>
        <Input
          id="api-key"
          type="password"
          className="mt-1.5"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            hasStoredKey
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
        Requests go directly from this extension to {meta.name} using your key.
        Usage is billed to your own provider account, and you are responsible
        for those costs. We never see or store your key on any server.
      </Alert>

      {result && (
        <Alert tone={result.ok ? "strong" : "danger"}>
          <span className="flex items-center gap-1.5">
            {result.ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.message}
          </span>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={testing}
          disabled={!apiKey && !hasStoredKey}
          onClick={() => void test()}
        >
          Test connection
        </Button>
        <Button
          loading={saving}
          disabled={!apiKey && !hasStoredKey}
          onClick={() => void save()}
        >
          Save
        </Button>
        {hasStoredKey && (
          <Button
            variant="ghost"
            loading={saving}
            onClick={() => void removeKey()}
          >
            Remove key
          </Button>
        )}
      </div>
    </div>
  );
}
