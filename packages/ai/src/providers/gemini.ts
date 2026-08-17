import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderConfig,
  AIProviderMeta,
} from "@job-ai/types";
import { AIError } from "@job-ai/types";
import { CONNECTION_TEST, postJson, requireKey, resolveModel } from "./base.ts";

export const GEMINI_META: AIProviderMeta = {
  id: "gemini",
  name: "Google Gemini",
  keyUrl: "https://aistudio.google.com/apikey",
  defaultModel: "gemini-3.6-flash",
  models: ["gemini-3.6-flash"],
  origin: "https://generativelanguage.googleapis.com/*",
  requiresKey: true,
};

interface GenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly meta = GEMINI_META;
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private get baseUrl(): string {
    return (
      this.config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/$/, "");
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = requireKey(this.config);
    const model =
      this.config.model?.trim() || resolveModel(this.config, this.meta);
    const started = Date.now();

    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature ?? this.config.temperature,
      maxOutputTokens: req.maxOutputTokens ?? this.config.maxOutputTokens,
    };
    if (req.jsonSchema) {
      const geminiSchema = toGeminiSchema(req.jsonSchema);
      generationConfig["responseMimeType"] = "application/json";
      generationConfig["responseSchema"] = geminiSchema;
    }

    const json = await postJson<GenerateContentResponse>({
      url: `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "x-goog-api-key": key },
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig,
      },
      ...(req.signal ? { signal: req.signal } : {}),
    });

    if (json.promptFeedback?.blockReason) {
      throw new AIError(
        "blocked",
        `The provider blocked this request (${json.promptFeedback.blockReason}).`,
      );
    }

    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    if (!text)
      throw new AIError(
        "invalid-response",
        "The model returned an empty response.",
        true,
      );

    return {
      text,
      usage: {
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        model,
        provider: "gemini",
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
}

function toGeminiSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const allowedKeys = new Set([
    "type",
    "format",
    "description",
    "nullable",
    "enum",
    "properties",
    "required",
    "items",
  ]);

  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(clean);
    }

    if (!node || typeof node !== "object") {
      return node;
    }

    const source = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      if (!allowedKeys.has(key)) {
        continue;
      }

      if (key === "properties" && value && typeof value === "object") {
        const properties: Record<string, unknown> = {};

        for (const [propertyName, propertySchema] of Object.entries(
          value as Record<string, unknown>,
        )) {
          properties[propertyName] = clean(propertySchema);
        }

        result.properties = properties;
        continue;
      }

      if (key === "required" && Array.isArray(value)) {
        const properties =
          source.properties && typeof source.properties === "object"
            ? (source.properties as Record<string, unknown>)
            : {};

        result.required = value.filter(
          (propertyName): propertyName is string =>
            typeof propertyName === "string" &&
            Object.prototype.hasOwnProperty.call(properties, propertyName),
        );

        continue;
      }

      result[key] = clean(value);
    }

    return result;
  };

  return clean(schema) as Record<string, unknown>;
}
