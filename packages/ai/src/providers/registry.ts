import type { AIProvider, AIProviderConfig, AIProviderId, AIProviderMeta } from '@job-ai/types';
import { ANTHROPIC_META, AnthropicProvider } from './anthropic.ts';
import { GEMINI_META, GeminiProvider } from './gemini.ts';
import { MOCK_META, MockProvider } from './mock.ts';
import { OPENAI_META, OpenAIProvider } from './openai.ts';
import { OPENROUTER_META, OpenRouterProvider } from './openrouter.ts';

export const PROVIDER_META: Record<AIProviderId, AIProviderMeta> = {
  openai: OPENAI_META,
  anthropic: ANTHROPIC_META,
  gemini: GEMINI_META,
  openrouter: OPENROUTER_META,
  mock: MOCK_META,
};

export const SELECTABLE_PROVIDERS: AIProviderMeta[] = [
  OPENAI_META,
  ANTHROPIC_META,
  GEMINI_META,
  OPENROUTER_META,
];

export const PROVIDER_ORIGINS = SELECTABLE_PROVIDERS.map((p) => p.origin);

export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'gemini':
      return new GeminiProvider(config);
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'mock':
      return new MockProvider();
  }
}

export function providerLabel(id: AIProviderId): string {
  return PROVIDER_META[id].name;
}

export function isConfigured(config: AIProviderConfig): boolean {
  const meta = PROVIDER_META[config.provider];
  return !meta.requiresKey || config.apiKey.trim().length > 0;
}

export { AnthropicProvider, GeminiProvider, MockProvider, OpenAIProvider, OpenRouterProvider };
export { ANTHROPIC_META, GEMINI_META, MOCK_META, OPENAI_META, OPENROUTER_META };
