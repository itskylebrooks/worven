import { SUPPORTED_LANGUAGES } from '../constants/languages';
import { decryptValue, encryptValue, isEncryptedValue } from './secure-storage';
import type { EncryptedValue } from './secure-storage';
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

type PersistedApiKey = string | EncryptedValue;

interface PersistedSettings extends Omit<AppSettings, 'apiKeys'> {
  apiKeys?: Partial<Record<ProviderId, PersistedApiKey | unknown>>;
}

function recoverLegacyApiKeyValue(value: unknown, provider: ProviderId): string {
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

function normalizePlaintextApiKeys(
  apiKeys: Partial<Record<ProviderId, unknown>> | undefined,
): Record<ProviderId, string> {
  return {
    openai: isEncryptedValue(apiKeys?.openai)
      ? ''
      : recoverLegacyApiKeyValue(apiKeys?.openai, 'openai'),
    anthropic: isEncryptedValue(apiKeys?.anthropic)
      ? ''
      : recoverLegacyApiKeyValue(apiKeys?.anthropic, 'anthropic'),
    gemini: isEncryptedValue(apiKeys?.gemini)
      ? ''
      : recoverLegacyApiKeyValue(apiKeys?.gemini, 'gemini'),
  };
}

function readPersistedSettings(): PersistedSettings | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as PersistedSettings;
}

function isProviderId(value: unknown): value is ProviderId {
  return value === 'openai' || value === 'anthropic' || value === 'gemini';
}

function getProviderSettings(
  parsed: PersistedSettings | null,
): Pick<AppSettings, 'provider' | 'model'> {
  const provider = isProviderId(parsed?.provider) ? parsed.provider : DEFAULT_SETTINGS.provider;
  const availableModels = PROVIDER_MODELS[provider];
  const model =
    parsed?.model && availableModels.includes(parsed.model) ? parsed.model : availableModels[0];

  return { provider, model };
}

function normalizeStoredSettings(parsed: PersistedSettings | null): AppSettings {
  const { provider, model } = getProviderSettings(parsed);

  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    provider,
    model,
    apiKeys: normalizePlaintextApiKeys(parsed?.apiKeys),
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

export function loadSettingsSnapshot(): AppSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    return normalizeStoredSettings(readPersistedSettings());
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function loadSettings(): Promise<AppSettings> {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = readPersistedSettings();
    const baseSettings = normalizeStoredSettings(parsed);
    const apiKeys = parsed?.apiKeys;
    const openaiKey = apiKeys?.openai;
    const anthropicKey = apiKeys?.anthropic;
    const geminiKey = apiKeys?.gemini;

    return {
      ...baseSettings,
      apiKeys: {
        openai: isEncryptedValue(openaiKey)
          ? await decryptValue(openaiKey)
          : recoverLegacyApiKeyValue(openaiKey, 'openai'),
        anthropic: isEncryptedValue(anthropicKey)
          ? await decryptValue(anthropicKey)
          : recoverLegacyApiKeyValue(anthropicKey, 'anthropic'),
        gemini: isEncryptedValue(geminiKey)
          ? await decryptValue(geminiKey)
          : recoverLegacyApiKeyValue(geminiKey, 'gemini'),
      },
    };
  } catch {
    return loadSettingsSnapshot();
  }
}

let persistSequence = 0;

export async function persistSettings(settings: AppSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  const currentSequence = ++persistSequence;

  try {
    const encryptedApiKeys = {
      openai: settings.apiKeys.openai.trim() ? await encryptValue(settings.apiKeys.openai) : '',
      anthropic: settings.apiKeys.anthropic.trim()
        ? await encryptValue(settings.apiKeys.anthropic)
        : '',
      gemini: settings.apiKeys.gemini.trim() ? await encryptValue(settings.apiKeys.gemini) : '',
    };

    if (currentSequence !== persistSequence) {
      return;
    }

    const persistedSettings: PersistedSettings = {
      ...settings,
      apiKeys: encryptedApiKeys,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedSettings));
  } catch {
    if (currentSequence !== persistSequence) {
      return;
    }

    const persistedSettings: PersistedSettings = {
      ...settings,
      apiKeys: {
        openai: '',
        anthropic: '',
        gemini: '',
      },
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedSettings));
  }
}
