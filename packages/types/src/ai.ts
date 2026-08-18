import { z } from "zod";

export const AIProviderId = z.enum([
  "openai",
  "anthropic",
  "gemini",
  "openrouter",
  "custom",
  "mock",
]);
export type AIProviderId = z.infer<typeof AIProviderId>;

export const AIProviderMeta = z.object({
  id: AIProviderId,
  name: z.string(),

  keyUrl: z.string(),
  defaultModel: z.string(),
  models: z.array(z.string()),

  origin: z.string(),
  requiresKey: z.boolean(),
});
export type AIProviderMeta = z.infer<typeof AIProviderMeta>;

export const AIProviderConfig = z.object({
  provider: AIProviderId.default("mock"),
  model: z.string().default(""),

  apiKey: z.string().default(""),

  baseUrl: z.string().default(""),
  customName: z.string().default(""),
  temperature: z.number().min(0).max(2).default(0.2),
  maxOutputTokens: z.number().min(256).max(32000).default(4096),
});
export type AIProviderConfig = z.infer<typeof AIProviderConfig>;

export const AIErrorCode = z.enum([
  "no-key",
  "invalid-key",
  "rate-limited",
  "quota-exceeded",
  "unavailable",
  "network",
  "timeout",
  "too-large",
  "invalid-response",
  "blocked",
  "unknown",
]);
export type AIErrorCode = z.infer<typeof AIErrorCode>;

export class AIError extends Error {
  readonly code: AIErrorCode;

  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(
    code: AIErrorCode,
    message: string,
    retryable = false,
    status?: number,
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export const AI_ERROR_MESSAGES: Record<AIErrorCode, string> = {
  "no-key":
    "No API key configured. Add one in Settings, or continue with local-only analysis.",
  "invalid-key":
    "Your API key was rejected by the provider. Check it in Settings.",
  "rate-limited":
    "The provider rate-limited this request. Wait a moment and try again.",
  "quota-exceeded": "Your provider account is out of quota or credit.",
  unavailable:
    "The AI provider is currently unavailable. Local analysis is still available.",
  network: "Network request failed. Check your connection and try again.",
  timeout: "The request took too long and was cancelled.",
  "too-large":
    "This job description or resume is too large to send. It has been truncated — try again.",
  "invalid-response":
    "The model returned an unexpected format. You can retry or use local analysis.",
  blocked:
    "The provider blocked this request. Try a different model or provider.",
  unknown: "Something went wrong talking to the AI provider.",
};

export const AIUsage = z.object({
  inputTokens: z.number().default(0),
  outputTokens: z.number().default(0),
  model: z.string().default(""),
  provider: AIProviderId.default("mock"),
  latencyMs: z.number().default(0),
});
export type AIUsage = z.infer<typeof AIUsage>;

export interface AICompletionRequest {
  task?: string;

  system: string;

  user: string;

  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface AICompletionResponse {
  text: string;
  usage: AIUsage;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly meta: AIProviderMeta;
  complete(req: AICompletionRequest): Promise<AICompletionResponse>;

  testConnection(
    signal?: AbortSignal,
  ): Promise<{ ok: true } | { ok: false; error: AIError }>;

  listModels?(signal?: AbortSignal): Promise<string[]>;
}
