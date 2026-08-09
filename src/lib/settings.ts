import { SUPPORTED_LANGUAGES } from '../constants/languages';
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  PROVIDER_IDS,
  PROVIDER_MODELS,
  isProviderId,
} from './provider-config';
import { decryptValue, encryptValue, isEncryptedValue } from './secure-storage';
import type { EncryptedValue } from './secure-storage';
import type { AppSettings, ProviderId, ThemeMode } from '../types';
import { isRecord, isSupportedLanguage, isTranslationContext } from './translation-contract';

export const STORAGE_KEY = 'worven-settings';
export const SETTINGS_STORAGE_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
  apiKeys: Object.fromEntries(PROVIDER_IDS.map((provider) => [provider, ''])) as Record<
    ProviderId,
    string
  >,
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
  return Object.fromEntries(
    PROVIDER_IDS.map((provider) => {
      const value = apiKeys?.[provider];
      return [provider, isEncryptedValue(value) ? '' : recoverLegacyApiKeyValue(value, provider)];
    }),
  ) as Record<ProviderId, string>;
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

  if (parsed.version === SETTINGS_STORAGE_VERSION && isRecord(parsed.settings)) {
    return parsed.settings as PersistedSettings;
  }

  return parsed as PersistedSettings;
}

function getProviderSettings(
  parsed: PersistedSettings | null,
): Pick<AppSettings, 'provider' | 'model'> {
  const provider = isProviderId(parsed?.provider) ? parsed.provider : DEFAULT_PROVIDER;
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
    const decryptedApiKeys = await Promise.all(
      PROVIDER_IDS.map(async (provider) => {
        const value = apiKeys?.[provider];
        return [
          provider,
          isEncryptedValue(value)
            ? await decryptValue(value)
            : recoverLegacyApiKeyValue(value, provider),
        ] as const;
      }),
    );

    return {
      ...baseSettings,
      apiKeys: Object.fromEntries(decryptedApiKeys) as Record<ProviderId, string>,
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
    const encryptedApiKeys = Object.fromEntries(
      await Promise.all(
        PROVIDER_IDS.map(async (provider) => [
          provider,
          settings.apiKeys[provider].trim() ? await encryptValue(settings.apiKeys[provider]) : '',
        ]),
      ),
    ) as Record<ProviderId, PersistedApiKey>;

    if (currentSequence !== persistSequence) {
      return;
    }

    const persistedSettings: PersistedSettings = {
      ...settings,
      apiKeys: encryptedApiKeys,
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
      apiKeys: Object.fromEntries(PROVIDER_IDS.map((provider) => [provider, ''])),
    };

    const envelope: PersistedSettingsEnvelope = {
      version: SETTINGS_STORAGE_VERSION,
      settings: persistedSettings,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }
}
