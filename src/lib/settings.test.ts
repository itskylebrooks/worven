import { beforeEach, describe, expect, it, vi } from 'vitest';

const encryptValueMock = vi.hoisted(() =>
  vi.fn(async (value: string) => ({
    scheme: 'aes-gcm' as const,
    iv: 'iv',
    ciphertext: `enc:${value}`,
  })),
);

vi.mock('./secure-storage', () => ({
  decryptValue: vi.fn(async () => ''),
  encryptValue: encryptValueMock,
  isEncryptedValue: (value: unknown) =>
    typeof value === 'object' &&
    value !== null &&
    (value as { scheme?: unknown }).scheme === 'aes-gcm',
}));

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_VERSION,
  STORAGE_KEY,
  loadSettingsSnapshot,
  persistSettings,
} from './settings';

describe('settings provider defaults', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    encryptValueMock.mockClear();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        clear: () => {
          storage.clear();
        },
      },
    });
  });

  it('defaults fresh installs to OpenAI without a key', () => {
    expect(loadSettingsSnapshot()).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-mini',
      apiKeys: { openai: '', anthropic: '', gemini: '' },
    });
  });

  it('migrates legacy Groq settings to OpenAI', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        apiKeys: {
          groq: '',
          openai: '',
          anthropic: '',
          gemini: '',
        },
      }),
    );

    expect(loadSettingsSnapshot()).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-mini',
    });
  });

  it('keeps a selected private-key provider even before a key is entered', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        apiKeys: {
          openai: '',
          anthropic: '',
          gemini: '',
        },
      }),
    );

    expect(loadSettingsSnapshot()).toMatchObject({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });

  it('encrypts user-owned provider keys before persistence', async () => {
    await persistSettings({
      ...DEFAULT_SETTINGS,
      apiKeys: {
        openai: 'sk-test',
        anthropic: '',
        gemini: '',
      },
    });

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      version?: number;
      settings?: { apiKeys?: Record<string, unknown> };
    };

    expect(persisted.version).toBe(SETTINGS_STORAGE_VERSION);
    expect(persisted.settings?.apiKeys).toMatchObject({
      openai: {
        scheme: 'aes-gcm',
        iv: 'iv',
        ciphertext: 'enc:sk-test',
      },
    });
  });

  it('falls back from invalid persisted domain values', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: SETTINGS_STORAGE_VERSION,
        settings: {
          ...DEFAULT_SETTINGS,
          nativeLanguage: 'Invalid language',
          targetLanguage: 'Invalid language',
          translationContext: 'Invalid context',
          themeMode: 'invalid-theme',
        },
      }),
    );

    expect(loadSettingsSnapshot()).toMatchObject({
      nativeLanguage: DEFAULT_SETTINGS.nativeLanguage,
      targetLanguage: DEFAULT_SETTINGS.targetLanguage,
      translationContext: DEFAULT_SETTINGS.translationContext,
      themeMode: DEFAULT_SETTINGS.themeMode,
    });
  });
});
