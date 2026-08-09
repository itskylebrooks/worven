import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTranslateApi } from './translate-api.js';

type TestRequestOverrides = Partial<Parameters<typeof handleTranslateApi>[0]>;

function createRequest(body: unknown, overrides: TestRequestOverrides = {}) {
  return {
    method: 'POST',
    url: '/api/translate',
    body: JSON.stringify(body),
    headers: {
      'x-forwarded-for': '1.2.3.4',
    },
    ...overrides,
  };
}

function createResponse() {
  let responseBody = '';
  const headers = new Map<string, string>();

  return {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    end(body?: string) {
      responseBody = body ?? '';
    },
    readJson() {
      return responseBody ? (JSON.parse(responseBody) as Record<string, unknown>) : {};
    },
    headers,
  };
}

const wordRequest = {
  sourceText: 'gehen',
  targetLanguage: 'German',
  nativeLanguage: 'English',
  context: 'General',
  mode: 'word',
} as const;

const sentenceRequest = {
  sourceText: 'Hello there',
  targetLanguage: 'German',
  nativeLanguage: 'English',
  context: 'General',
  mode: 'sentence',
} as const;

describe('/api/translate', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses the server Groq key for word translations', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  primary: 'to go',
                  alternatives: [
                    { term: 'gehen', gloss: 'go' },
                    { term: 'laufen', gloss: 'walk' },
                    { term: 'reisen', gloss: 'travel' },
                  ],
                  antonyms: [{ term: 'bleiben', gloss: 'stay' }],
                  etymology: 'From Old High German "gangan".',
                  pronunciation: 'gayn',
                  verbConjugation: null,
                  nounCases: null,
                  examples: [
                    { source: 'Ich gehe.', target: 'I am going.' },
                    { source: 'Geh jetzt.', target: 'Go now.' },
                    { source: 'Wir gehen morgen.', target: 'We are going tomorrow.' },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const req = createRequest({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      apiKey: '',
      request: wordRequest,
    });
    const res = createResponse();

    await handleTranslateApi(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.readJson().result).toMatchObject({
      primary: 'to go',
      antonyms: [{ term: 'bleiben', gloss: 'stay' }],
      etymology: 'From Old High German "gangan".',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer groq-secret',
        }),
        signal: expect.any(AbortSignal),
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const parsedBody = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
    expect(parsedBody.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: expect.objectContaining({
        name: 'word_translation',
        strict: true,
      }),
    });
  });

  it('supports standard Groq sentence translations', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  translation: 'Hallo da',
                  alternative: null,
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        request: sentenceRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.readJson().result).toEqual({
      translation: 'Hallo da',
      alternative: null,
    });
  });

  it.each(['llama-3.3-70b-versatile', 'qwen/qwen3-32b'])(
    'uses json_object mode for Groq fallback model %s',
    async (model) => {
      vi.stubEnv('GROQ_API_KEY', 'groq-secret');
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    translation: 'Hallo da',
                    alternative: null,
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const res = createResponse();

      await handleTranslateApi(
        createRequest({
          provider: 'groq',
          model,
          request: sentenceRequest,
        }),
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(res.readJson().result).toEqual({
        translation: 'Hallo da',
        alternative: null,
      });

      const requestInit = fetchMock.mock.calls[0]?.[1];
      const parsedBody = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
      expect(parsedBody.response_format).toEqual({
        type: 'json_object',
      });
    },
  );

  it('supports Groq alternative sentence responses', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  translation: 'Hallo da',
                  alternative: 'Gruss dich',
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        request: {
          ...sentenceRequest,
          requestAlternative: true,
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.readJson().result).toEqual({
      translation: 'Hallo da',
      alternative: 'Gruss dich',
    });
  });

  it('fails clearly when the Groq server key is missing', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        request: wordRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.readJson()).toEqual({
      error: 'Groq is not configured on the server. Add GROQ_API_KEY to your environment variables.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still requires client keys for non-Groq providers', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKey: '',
        request: sentenceRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.readJson()).toEqual({
      error: 'Add an API key for the selected provider in Settings before translating.',
    });
  });

  it('rejects tampered models before calling an upstream provider', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        request: sentenceRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.readJson()).toEqual({
      error: 'Unsupported model for the selected provider.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed request fields before calling an upstream provider', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        request: {
          ...sentenceRequest,
          context: 'Untrusted context',
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.readJson()).toEqual({
      error: 'Translation request payload is invalid.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies before parsing them', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKey: 'sk-openai',
        request: {
          ...sentenceRequest,
          sourceText: 'a'.repeat(70_000),
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(413);
    expect(res.readJson()).toEqual({
      error: 'Translation request body is too large.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces Groq refusal messages', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                refusal: 'Refused for safety reasons.',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        request: sentenceRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(res.readJson()).toEqual({
      error: 'Refused for safety reasons.',
    });
  });

  it('rate limits Groq requests without blocking other providers', async () => {
    vi.stubEnv('GROQ_API_KEY', 'groq-secret');
    fetchMock.mockImplementation(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  translation: 'Hallo da',
                  alternative: null,
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    for (let index = 0; index < 20; index += 1) {
      const res = createResponse();
      await handleTranslateApi(
        createRequest(
          {
            provider: 'groq',
            model: 'openai/gpt-oss-20b',
            request: sentenceRequest,
          },
          {
            headers: {
              'x-forwarded-for': '9.9.9.9',
            },
          },
        ),
        res,
      );
      expect(res.statusCode).toBe(200);
    }

    const limitedRes = createResponse();
    await handleTranslateApi(
      createRequest(
        {
          provider: 'groq',
          model: 'openai/gpt-oss-20b',
          request: sentenceRequest,
        },
        {
          headers: {
            'x-forwarded-for': '9.9.9.9',
          },
        },
      ),
      limitedRes,
    );

    expect(limitedRes.statusCode).toBe(429);
    expect(limitedRes.headers.get('Retry-After')).toBeTruthy();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            translation: 'Hallo da',
            alternative: null,
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const openaiRes = createResponse();
    await handleTranslateApi(
      createRequest(
        {
          provider: 'openai',
          model: 'gpt-5.4-mini',
          apiKey: 'sk-openai',
          request: sentenceRequest,
        },
        {
          headers: {
            'x-forwarded-for': '9.9.9.9',
          },
        },
      ),
      openaiRes,
    );

    expect(openaiRes.statusCode).toBe(200);
  });
});
