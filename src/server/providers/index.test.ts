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
    {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      endpoint: 'https://api.deepseek.com/chat/completions',
      responseBody: {
        choices: [
          {
            message: {
              content: JSON.stringify({ translation: 'Hallo da', alternative: null }),
            },
          },
        ],
      },
    },
    {
      provider: 'xai',
      model: 'grok-4.5',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      responseBody: {
        choices: [
          {
            message: {
              content: JSON.stringify({ translation: 'Hallo da', alternative: null }),
            },
          },
        ],
      },
    },
  ])(
    'normalizes the $provider response envelope',
    async ({ provider, model, endpoint, responseBody }) => {
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
    },
  );

  it('requests JSON output from DeepSeek', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ translation: 'Hallo da', alternative: null }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await callProvider('deepseek', 'deepseek-key', 'deepseek-v4-flash', request);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as { response_format?: unknown };
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('requests strict structured output from xAI with low reasoning effort', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ translation: 'Hallo da', alternative: null }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await callProvider('xai', 'xai-key', 'grok-4.5', request);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as {
      reasoning_effort?: unknown;
      response_format?: unknown;
    };
    expect(body.reasoning_effort).toBe('low');
    expect(body.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'sentence_translation',
        schema: expect.any(Object),
        strict: true,
      },
    });
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
