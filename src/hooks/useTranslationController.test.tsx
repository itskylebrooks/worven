import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../lib/settings';

const translateWithProviderMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/providers', () => ({
  translateWithProvider: translateWithProviderMock,
}));

import { useTranslationController } from './useTranslationController';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useTranslationController', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    translateWithProviderMock.mockReset();
  });

  it('aborts superseded requests and ignores their eventual response', async () => {
    const firstResponse = deferred<{ translation: string; alternative: null }>();
    const secondResponse = deferred<{ translation: string; alternative: null }>();
    translateWithProviderMock
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise);

    const { result } = renderHook(() =>
      useTranslationController({
        settings: DEFAULT_SETTINGS,
        updateSettings: vi.fn(),
      }),
    );

    act(() => result.current.setSourceText('First sentence.'));
    let firstRun!: Promise<void>;
    act(() => {
      firstRun = result.current.translate();
    });

    const firstSignal = translateWithProviderMock.mock.calls[0]?.[4] as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    act(() => result.current.setSourceText('Second sentence.'));
    let secondRun!: Promise<void>;
    act(() => {
      secondRun = result.current.translate();
    });

    expect(firstSignal.aborted).toBe(true);

    await act(async () => {
      secondResponse.resolve({ translation: 'Zweiter Satz.', alternative: null });
      await secondRun;
    });

    expect(result.current.result).toMatchObject({
      mode: 'sentence',
      sourceText: 'Second sentence.',
      data: { translation: 'Zweiter Satz.' },
    });

    await act(async () => {
      firstResponse.resolve({ translation: 'Erster Satz.', alternative: null });
      await firstRun;
    });

    expect(result.current.result).toMatchObject({
      sourceText: 'Second sentence.',
      data: { translation: 'Zweiter Satz.' },
    });
  });
});
