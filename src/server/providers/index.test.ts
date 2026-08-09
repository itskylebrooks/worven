import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderId, TranslationRequest } from '../../types.js';
import { callProvider, ProviderError } from './index.js';

const request: TranslationRequest = {
  sourceText: 'Hello there',
  targetLanguage: 'German',
  nativeLanguage: 'English',
  context: 'General',
  mode: 'sentence',
};

describe('translation provider adapters', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<{
    provider: ProviderId;
    model: string;
    endpoint: string;
    responseBody: unknown;
  }>([
    {
      provider: 'openai',
      model: 'gpt-5.4-mini',
      endpoint: 'https://api.openai.com/v1/responses',
      responseBody: {
        output_text: JSON.stringify({ translation: 'Hallo da', alternative: null }),
      },
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      endpoint: 'https://api.anthropic.com/v1/messages',
      responseBody: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ translation: 'Hallo da', alternative: null }),
          },
        ],
      },
    },
    {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      endpoint:
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      responseBody: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ translation: 'Hallo da', alternative: null }),
                },
              ],
            },
          },
        ],
      },
    },
  ])('normalizes the $provider response envelope', async ({
    provider,
    model,
    endpoint,
    responseBody,
  }) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(callProvider(provider, 'provider-key', model, request)).resolves.toEqual({
      translation: 'Hallo da',
      alternative: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('maps a rejected client key to an authentication response', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Incorrect API key.' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await callProvider('openai', 'bad-key', 'gpt-5.4-mini', request).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ status: 401, message: 'Incorrect API key.' });
  });

  it('maps provider timeouts to a gateway timeout', async () => {
    const timeoutError = new Error('timed out');
    timeoutError.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeoutError);

    const error = await callProvider('gemini', 'provider-key', 'gemini-2.5-flash', request).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ status: 504 });
  });
});
