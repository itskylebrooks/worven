import { SUPPORTED_LANGUAGES } from '../constants/languages';
import type { AppSettings, ProviderId, ThemeMode } from '../types';

export const STORAGE_KEY = 'worven-settings';

export const PROVIDER_MODELS: Record<ProviderId, string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5.4-nano'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro'],
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'openai',
  model: PROVIDER_MODELS.openai[0],
  apiKeys: {
    openai: '',
    anthropic: '',
    gemini: '',
  },
  nativeLanguage: SUPPORTED_LANGUAGES[0],
  targetLanguage: 'German',
  translationContext: 'General',
  themeMode: 'system',
};

function recoverApiKeyValue(value: unknown, provider: ProviderId): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (!trimmed.startsWith('{')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<AppSettings> & {
      apiKeys?: Partial<Record<ProviderId, string>>;
    };
    const nestedKey = parsed.apiKeys?.[provider];
    return typeof nestedKey === 'string' ? nestedKey.trim() : trimmed;
  } catch {
    return trimmed;
  }
}

function normalizeApiKeys(
  apiKeys: Partial<Record<ProviderId, unknown>> | undefined,
): Record<ProviderId, string> {
  return {
    openai: recoverApiKeyValue(apiKeys?.openai, 'openai'),
    anthropic: recoverApiKeyValue(apiKeys?.anthropic, 'anthropic'),
    gemini: recoverApiKeyValue(apiKeys?.gemini, 'gemini'),
  };
}

export function getResolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function applyTheme(mode: ThemeMode) {
  const resolved = getResolvedTheme(mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const provider = parsed.provider ?? DEFAULT_SETTINGS.provider;
    const availableModels = PROVIDER_MODELS[provider];
    const model =
      parsed.model && availableModels.includes(parsed.model) ? parsed.model : availableModels[0];

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      provider,
      model,
      apiKeys: normalizeApiKeys(parsed.apiKeys),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function persistSettings(settings: AppSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
