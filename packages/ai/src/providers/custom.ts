import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderConfig,
  AIProviderMeta,
} from "@job-ai/types";
import { AIError } from "@job-ai/types";
import { CONNECTION_TEST, getJson, postJson, resolveModel } from "./base.ts";

export const CUSTOM_META: AIProviderMeta = {
  id: "custom",
  name: "Custom",
  keyUrl: "",
  defaultModel: "",
  models: [],
  origin: "*",
  requiresKey: false,
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class CustomProvider implements AIProvider {
  readonly id = "custom" as const;
  readonly meta = CUSTOM_META;
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || "").replace(/\/$/, "");
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = this.config.apiKey;
    const model = this.config.model.trim() || resolveModel(this.config, this.meta);
    const started = Date.now();

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      temperature: req.temperature ?? this.config.temperature,
      max_tokens: req.maxOutputTokens ?? this.config.maxOutputTokens,
    };

    if (req.jsonSchema) {
      body["response_format"] = {
        type: "json_schema",
        json_schema: { name: "result", strict: false, schema: req.jsonSchema },
      };
    }

    if (!this.baseUrl) {
      throw new AIError("network", "Base URL is required for custom provider", true);
    }

    const headers: Record<string, string> = {};
    if (key) {
      headers["authorization"] = `Bearer ${key}`;
    }

    const json = await postJson<ChatCompletionResponse>({
      url: `${this.baseUrl}/chat/completions`,
      headers,
      body,
      ...(req.signal ? { signal: req.signal } : {}),
    });

    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text)
      throw new AIError(
        "invalid-response",
        "The model returned an empty response.",
        true,
      );

    return {
      text,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        model,
        provider: "custom",
        latencyMs: Date.now() - started,
      },
    };
  }

  async testConnection(signal?: AbortSignal) {
    try {
      await this.complete({
        ...CONNECTION_TEST,
        ...(signal ? { signal } : {}),
      });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error:
          err instanceof AIError
            ? err
            : new AIError("unknown", "Connection test failed."),
      };
    }
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    if (!this.baseUrl) return [];
    try {
      const headers: Record<string, string> = {};
      if (this.config.apiKey) {
        headers["authorization"] = `Bearer ${this.config.apiKey}`;
      }
      const json = await getJson<{ data?: { id: string }[] }>({
        url: `${this.baseUrl}/models`,
        headers,
        ...(signal ? { signal } : {}),
      });
      return (json.data || []).map((m) => m.id);
    } catch (err) {
      return [];
    }
  }
}
