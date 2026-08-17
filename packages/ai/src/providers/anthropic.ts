import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderConfig,
  AIProviderMeta,
} from '@job-ai/types';
import { AIError } from '@job-ai/types';
import { CONNECTION_TEST, postJson, requireKey, resolveModel } from './base.ts';

export const ANTHROPIC_META: AIProviderMeta = {
  id: 'anthropic',
  name: 'Anthropic',
  keyUrl: 'https://console.anthropic.com/settings/keys',
  defaultModel: 'claude-sonnet-4-5',
  models: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  origin: 'https://api.anthropic.com/*',
  requiresKey: true,
};

interface MessagesResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly meta = ANTHROPIC_META;
  private readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  private get baseUrl(): string {
    return (this.config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const key = requireKey(this.config);
    const model = resolveModel(this.config, this.meta);
    const started = Date.now();

    const wantsJson = Boolean(req.jsonSchema);

    const json = await postJson<MessagesResponse>({
      url: `${this.baseUrl}/messages`,
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: {
        model,
        system: req.system,
        messages: [
          { role: 'user', content: req.user },
          ...(wantsJson ? [{ role: 'assistant', content: '{' }] : []),
        ],
        temperature: req.temperature ?? this.config.temperature,
        max_tokens: req.maxOutputTokens ?? this.config.maxOutputTokens,
      },
      ...(req.signal ? { signal: req.signal } : {}),
    });

    const raw = (json.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    if (!raw) throw new AIError('invalid-response', 'The model returned an empty response.', true);

    return {
      text: wantsJson ? `{${raw}` : raw,
      usage: {
        inputTokens: json.usage?.input_tokens ?? 0,
        outputTokens: json.usage?.output_tokens ?? 0,
        model,
        provider: 'anthropic',
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
