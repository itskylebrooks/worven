import type { ProviderId } from '../types.js';

export interface ProviderConfig {
  label: string;
  models: string[];
}

export const PROVIDER_CONFIGS: Record<ProviderId, ProviderConfig> = {
  openai: {
    label: 'OpenAI',
    models: ['gpt-5.4-mini', 'gpt-5.4-nano'],
  },
  anthropic: {
    label: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  gemini: {
    label: 'Gemini',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_CONFIGS) as ProviderId[];

export const PROVIDER_LABELS: Record<ProviderId, string> = Object.fromEntries(
  PROVIDER_IDS.map((provider) => [provider, PROVIDER_CONFIGS[provider].label]),
) as Record<ProviderId, string>;

export const PROVIDER_MODELS: Record<ProviderId, string[]> = Object.fromEntries(
  PROVIDER_IDS.map((provider) => [provider, PROVIDER_CONFIGS[provider].models]),
) as Record<ProviderId, string[]>;

export const DEFAULT_PROVIDER: ProviderId = 'openai';
export const DEFAULT_MODEL = PROVIDER_MODELS[DEFAULT_PROVIDER][0];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && value in PROVIDER_CONFIGS;
}

export function isAllowedModel(provider: ProviderId, model: string) {
  return PROVIDER_MODELS[provider].includes(model);
}
