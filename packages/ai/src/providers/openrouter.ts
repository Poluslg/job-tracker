import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderConfig,
  AIProviderMeta,
} from "@job-ai/types";
import { AIError } from "@job-ai/types";
import { CONNECTION_TEST, getJson, postJson, requireKey, resolveModel } from "./base.ts";

export const OPENROUTER_META: AIProviderMeta = {
  id: "openrouter",
  name: "OpenRouter",
  keyUrl: "https://openrouter.ai/keys",
  defaultModel: "anthropic/claude-sonnet-4.5",
  models: [
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-haiku-4.5",
    "openai/gpt-4.1-mini",
    "google/gemini-2.6-flash",
    "meta-llama/llama-3.3-70b-instruct",
  ],
  origin: "https://openrouter.ai/*",
  requiresKey: true,
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter" as const;
  readonly meta = OPENROUTER_META;
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || "https://openrouter.ai/api/v1").replace(
      /\/$/,
      "",
    );
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = requireKey(this.config);
    const model =
      this.config.model.trim() || resolveModel(this.config, this.meta);
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

    const json = await postJson<ChatCompletionResponse>({
      url: `${this.baseUrl}/chat/completions`,
      headers: {
        authorization: `Bearer ${key}`,
        "x-title": "AI Career Copilot",
      },
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
        provider: "openrouter",
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
    const json = await getJson<{ data?: { id: string }[] }>({
      url: `${this.baseUrl}/models`,
      ...(signal ? { signal } : {}),
    });

    return (json.data || []).map((m) => m.id);
  }
}
