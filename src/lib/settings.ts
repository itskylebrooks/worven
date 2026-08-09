import { SUPPORTED_LANGUAGES } from '../constants/languages';
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROVIDER_MODELS,
  isProviderId,
  providerUsesClientKey,
} from './provider-config';
import { decryptValue, encryptValue, isEncryptedValue } from './secure-storage';
import type { EncryptedValue } from './secure-storage';
import type { AppSettings, ProviderId, ThemeMode } from '../types';
import {
  isRecord,
  isSupportedLanguage,
  isTranslationContext,
} from './translation-contract';

export const STORAGE_KEY = 'worven-settings';
export const SETTINGS_STORAGE_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
  apiKeys: {
    groq: '',
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

interface PersistedSettings extends Partial<Omit<AppSettings, 'apiKeys'>> {
  apiKeys?: Partial<Record<ProviderId, PersistedApiKey | unknown>>;
}

interface PersistedSettingsEnvelope {
  version: typeof SETTINGS_STORAGE_VERSION;
  settings: PersistedSettings;
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
    groq: '',
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

function hasStoredApiKey(value: unknown, provider: ProviderId) {
  return isEncryptedValue(value) || recoverLegacyApiKeyValue(value, provider).length > 0;
}

function readPersistedSettings(): PersistedSettings | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    return null;
  }

  if (
    parsed.version === SETTINGS_STORAGE_VERSION &&
    isRecord(parsed.settings)
  ) {
    return parsed.settings as PersistedSettings;
  }

  return parsed as PersistedSettings;
}

function getProviderSettings(
  parsed: PersistedSettings | null,
): Pick<AppSettings, 'provider' | 'model'> {
  const requestedProvider = isProviderId(parsed?.provider) ? parsed.provider : DEFAULT_PROVIDER;
  const provider =
    providerUsesClientKey(requestedProvider) &&
    !hasStoredApiKey(parsed?.apiKeys?.[requestedProvider], requestedProvider)
      ? DEFAULT_PROVIDER
      : requestedProvider;
  const availableModels = PROVIDER_MODELS[provider];
  const model =
    parsed?.model && availableModels.includes(parsed.model) ? parsed.model : availableModels[0];

  return { provider, model };
}

function normalizeStoredSettings(parsed: PersistedSettings | null): AppSettings {
  const { provider, model } = getProviderSettings(parsed);

  return {
    provider,
    model,
    apiKeys: normalizePlaintextApiKeys(parsed?.apiKeys),
    nativeLanguage: isSupportedLanguage(parsed?.nativeLanguage)
      ? parsed.nativeLanguage
      : DEFAULT_SETTINGS.nativeLanguage,
    targetLanguage: isSupportedLanguage(parsed?.targetLanguage)
      ? parsed.targetLanguage
      : DEFAULT_SETTINGS.targetLanguage,
    translationContext: isTranslationContext(parsed?.translationContext)
      ? parsed.translationContext
      : DEFAULT_SETTINGS.translationContext,
    themeMode:
      parsed?.themeMode === 'system' ||
      parsed?.themeMode === 'light' ||
      parsed?.themeMode === 'dark'
        ? parsed.themeMode
        : DEFAULT_SETTINGS.themeMode,
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
        groq: '',
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
      groq: '',
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
      apiKeys: {
        ...encryptedApiKeys,
        groq: '',
      },
    };

    const envelope: PersistedSettingsEnvelope = {
      version: SETTINGS_STORAGE_VERSION,
      settings: persistedSettings,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    if (currentSequence !== persistSequence) {
      return;
    }

    const persistedSettings: PersistedSettings = {
      ...settings,
      apiKeys: {
        groq: '',
        openai: '',
        anthropic: '',
        gemini: '',
      },
    };

    const envelope: PersistedSettingsEnvelope = {
      version: SETTINGS_STORAGE_VERSION,
      settings: persistedSettings,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }
}
