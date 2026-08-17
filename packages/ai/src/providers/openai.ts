import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderConfig,
  AIProviderMeta,
} from '@job-ai/types';
import { AIError } from '@job-ai/types';
import { CONNECTION_TEST, postJson, requireKey, resolveModel } from './base.ts';

export const OPENAI_META: AIProviderMeta = {
  id: 'openai',
  name: 'OpenAI',
  keyUrl: 'https://platform.openai.com/api-keys',
  defaultModel: 'gpt-4.1-mini',
  models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini'],
  origin: 'https://api.openai.com/*',
  requiresKey: true,
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly meta = OPENAI_META;
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = requireKey(this.config);
    const model = resolveModel(this.config, this.meta);
    const started = Date.now();

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      temperature: req.temperature ?? this.config.temperature,
      max_completion_tokens: req.maxOutputTokens ?? this.config.maxOutputTokens,
    };

    if (req.jsonSchema) {
      body['response_format'] = {
        type: 'json_schema',
        json_schema: { name: 'result', strict: false, schema: req.jsonSchema },
      };
    }

    const json = await postJson<ChatCompletionResponse>({
      url: `${this.baseUrl}/chat/completions`,
      headers: { authorization: `Bearer ${key}` },
      body,
      ...(req.signal ? { signal: req.signal } : {}),
    });

    const text = json.choices?.[0]?.message?.content ?? '';
    if (!text) throw new AIError('invalid-response', 'The model returned an empty response.', true);

    return {
      text,
      usage: {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        model,
        provider: 'openai',
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
