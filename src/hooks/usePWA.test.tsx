import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePWA } from './usePWA';

function mockUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

function mockMatchMedia(options?: { standalone?: boolean; prefersDark?: boolean }) {
  const standalone = options?.standalone ?? false;
  const prefersDark = options?.prefersDark ?? false;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(display-mode: standalone)' ? standalone : prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function dispatchBeforeInstallPrompt(options?: { outcome?: 'accepted' | 'dismissed' }) {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt');

  Object.defineProperties(event, {
    prompt: {
      value: prompt,
      configurable: true,
    },
    userChoice: {
      value: Promise.resolve({ outcome: options?.outcome ?? 'accepted' }),
      configurable: true,
    },
  });

  window.dispatchEvent(event);
  return prompt;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePWA', () => {
  it('detects an installed standalone app shell', () => {
    mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    mockMatchMedia({ standalone: true });

    const { result } = renderHook(() => usePWA());

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(true);
    expect(result.current.nativePromptAvailable).toBe(false);
  });

  it('uses the deferred native prompt when available on Chromium', async () => {
    mockUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    );
    mockMatchMedia();

    const { result } = renderHook(() => usePWA());
    const prompt = dispatchBeforeInstallPrompt();

    await waitFor(() => {
      expect(result.current.installMode).toBe('native-prompt');
    });

    await act(async () => {
      const installed = await result.current.install();
      expect(installed).toBe(true);
    });

    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('falls back to the iOS share flow', () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    );
    mockMatchMedia();

    const { result } = renderHook(() => usePWA());

    expect(result.current.installMode).toBe('ios-share');
    expect(result.current.nativePromptAvailable).toBe(false);
  });

  it('falls back to Safari Add to Dock on macOS Safari', () => {
    mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    );
    mockMatchMedia();

    const { result } = renderHook(() => usePWA());

    expect(result.current.installMode).toBe('safari-mac');
  });

  it('uses the manual Android path for Firefox on Android', () => {
    mockUserAgent(
      'Mozilla/5.0 (Android 14; Mobile; rv:136.0) Gecko/136.0 Firefox/136.0',
    );
    mockMatchMedia();

    const { result } = renderHook(() => usePWA());

    expect(result.current.installMode).toBe('android-manual');
  });

  it('marks Firefox desktop as unsupported', () => {
    mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:136.0) Gecko/20100101 Firefox/136.0',
    );
    mockMatchMedia();

    const { result } = renderHook(() => usePWA());

    expect(result.current.installMode).toBe('unsupported');
  });
});
