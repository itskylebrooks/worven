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

import { DEFAULT_SETTINGS, STORAGE_KEY, loadSettingsSnapshot, persistSettings } from './settings';

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

  it('defaults fresh installs to Groq', () => {
    expect(loadSettingsSnapshot()).toMatchObject({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
    });
  });

  it('migrates legacy provider settings without a stored key to Groq', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKeys: {
          openai: '',
          anthropic: '',
          gemini: '',
        },
      }),
    );

    expect(loadSettingsSnapshot()).toMatchObject({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
    });
  });

  it('keeps a legacy client-key provider when a stored key exists', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKeys: {
          openai: 'sk-test',
          anthropic: '',
          gemini: '',
        },
      }),
    );

    expect(loadSettingsSnapshot()).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-mini',
      apiKeys: expect.objectContaining({
        groq: '',
        openai: 'sk-test',
      }),
    });
  });

  it('never persists a Groq key from the browser', async () => {
    await persistSettings({
      ...DEFAULT_SETTINGS,
      apiKeys: {
        groq: 'should-not-persist',
        openai: 'sk-test',
        anthropic: '',
        gemini: '',
      },
    });

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      apiKeys?: Record<string, unknown>;
    };

    expect(persisted.apiKeys).toMatchObject({
      groq: '',
      openai: {
        scheme: 'aes-gcm',
        iv: 'iv',
        ciphertext: 'enc:sk-test',
      },
    });
  });
});
