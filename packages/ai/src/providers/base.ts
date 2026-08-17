import type { AICompletionRequest, AIProviderConfig, AIProviderMeta } from '@job-ai/types';
import { AIError } from '@job-ai/types';

export const REQUEST_TIMEOUT_MS = 90_000;

export function errorFromStatus(status: number, body: string): AIError {
  const detail = extractProviderMessage(body);
  switch (status) {
    case 401:
    case 403:
      return new AIError('invalid-key', detail || 'The provider rejected your API key.', false, status);
    case 402:
      return new AIError('quota-exceeded', detail || 'Your provider account has no remaining credit.', false, status);
    case 413:
      return new AIError('too-large', detail || 'The request was too large for this model.', false, status);
    case 429:
      return new AIError('rate-limited', detail || 'Rate limit reached.', true, status);
    case 400:
      return new AIError('unknown', detail || 'The provider rejected the request.', false, status);
    default:
      if (status >= 500) {
        return new AIError('unavailable', detail || 'The provider is temporarily unavailable.', true, status);
      }
      return new AIError('unknown', detail || `Request failed with status ${status}.`, false, status);
  }
}

function extractProviderMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const error = obj['error'];
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object') {
        const msg = (error as Record<string, unknown>)['message'];
        if (typeof msg === 'string') return msg;
      }
      if (typeof obj['message'] === 'string') return obj['message'] as string;
    }
  } catch {
    
  }
  return body.slice(0, 300);
}

export interface FetchJsonOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal;
}

export async function postJson<T>(opts: FetchJsonOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const res = await fetch(opts.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...opts.headers },
      body: JSON.stringify(opts.body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw errorFromStatus(res.status, await res.text().catch(() => ''));
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AIError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw opts.signal?.aborted
        ? new AIError('unknown', 'Request cancelled.', false)
        : new AIError('timeout', 'The provider did not respond in time.', true);
    }
    throw new AIError('network', 'Could not reach the AI provider. Check your connection.', true);
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export function resolveModel(config: AIProviderConfig, meta: AIProviderMeta): string {
  return config.model && meta.models.includes(config.model) ? config.model : meta.defaultModel;
}

export function requireKey(config: AIProviderConfig): string {
  if (!config.apiKey.trim()) {
    throw new AIError('no-key', 'No API key configured for this provider.', false);
  }
  return config.apiKey.trim();
}

export const CONNECTION_TEST: AICompletionRequest = {
  system: 'You are a connection test. Reply with the single word: ok',
  user: 'ping',
  maxOutputTokens: 16,
  temperature: 0,
};
