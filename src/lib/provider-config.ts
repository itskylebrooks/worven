import type { ProviderId } from '../types.js';

export type ProviderKeyMode = 'client' | 'server';

export interface ProviderConfig {
  label: string;
  models: string[];
  keyMode: ProviderKeyMode;
}

export const PROVIDER_CONFIGS: Record<ProviderId, ProviderConfig> = {
  groq: {
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'],
    keyMode: 'server',
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-5.4-mini', 'gpt-5.4-nano'],
    keyMode: 'client',
  },
  anthropic: {
    label: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
    keyMode: 'client',
  },
  gemini: {
    label: 'Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    keyMode: 'client',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_CONFIGS) as ProviderId[];

export const PROVIDER_LABELS: Record<ProviderId, string> = Object.fromEntries(
  PROVIDER_IDS.map((provider) => [provider, PROVIDER_CONFIGS[provider].label]),
) as Record<ProviderId, string>;

export const PROVIDER_MODELS: Record<ProviderId, string[]> = Object.fromEntries(
  PROVIDER_IDS.map((provider) => [provider, PROVIDER_CONFIGS[provider].models]),
) as Record<ProviderId, string[]>;

export const DEFAULT_PROVIDER: ProviderId = 'groq';
export const DEFAULT_MODEL = PROVIDER_MODELS[DEFAULT_PROVIDER][0];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && value in PROVIDER_CONFIGS;
}

export function isAllowedModel(provider: ProviderId, model: string) {
  return PROVIDER_MODELS[provider].includes(model);
}

export function providerUsesClientKey(provider: ProviderId) {
  return PROVIDER_CONFIGS[provider].keyMode === 'client';
}

export function providerUsesServerKey(provider: ProviderId) {
  return PROVIDER_CONFIGS[provider].keyMode === 'server';
}
