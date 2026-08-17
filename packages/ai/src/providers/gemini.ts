import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderConfig,
  AIProviderMeta,
} from '@job-ai/types';
import { AIError } from '@job-ai/types';
import { CONNECTION_TEST, postJson, requireKey, resolveModel } from './base.ts';

export const GEMINI_META: AIProviderMeta = {
  id: 'gemini',
  name: 'Google Gemini',
  keyUrl: 'https://aistudio.google.com/apikey',
  defaultModel: 'gemini-2.5-flash',
  models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  origin: 'https://generativelanguage.googleapis.com/*',
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
  readonly id = 'gemini' as const;
  readonly meta = GEMINI_META;
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = requireKey(this.config);
    const model = resolveModel(this.config, this.meta);
    const started = Date.now();

    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature ?? this.config.temperature,
      maxOutputTokens: req.maxOutputTokens ?? this.config.maxOutputTokens,
    };
    if (req.jsonSchema) {
      generationConfig['responseMimeType'] = 'application/json';
      generationConfig['responseSchema'] = toGeminiSchema(req.jsonSchema);
    }

    const json = await postJson<GenerateContentResponse>({
      // The key goes in a header, never in the query string — URLs end up in logs.
      url: `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
      headers: { 'x-goog-api-key': key },
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig,
      },
      ...(req.signal ? { signal: req.signal } : {}),
    });

    if (json.promptFeedback?.blockReason) {
      throw new AIError('blocked', `The provider blocked this request (${json.promptFeedback.blockReason}).`);
    }

    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text) throw new AIError('invalid-response', 'The model returned an empty response.', true);

    return {
      text,
      usage: {
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        model,
        provider: 'gemini',
        latencyMs: Date.now() - started,
      },
    };
  }

  async testConnection(signal?: AbortSignal) {
    try {
      await this.complete({ ...CONNECTION_TEST, ...(signal ? { signal } : {}) });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof AIError ? err : new AIError('unknown', 'Connection test failed.'),
      };
    }
  }
}

/**
 * Gemini accepts a subset of JSON Schema. Strip the keywords it rejects
 * (`additionalProperties`, `$schema`) rather than failing the request.
 */
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === 'additionalProperties' || k === '$schema' || k === 'default') continue;
      out[k] = clean(v);
    }
    return out;
  };
  return clean(schema) as Record<string, unknown>;
}

