import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleTranslateApi } from './translate-api.js';

type TestRequestOverrides = Partial<Parameters<typeof handleTranslateApi>[0]>;

function createRequest(body: unknown, overrides: TestRequestOverrides = {}) {
  return {
    method: 'POST',
    url: '/api/translate',
    body: JSON.stringify(body),
    headers: {},
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards a user-owned key for a supported provider', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
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
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKey: 'sk-user-owned',
        request: wordRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.readJson().result).toMatchObject({ primary: 'to go' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-user-owned' }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('requires a user API key before making an upstream request', async () => {
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects the removed Groq provider', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        request: sentenceRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.readJson()).toEqual({ error: 'Unsupported provider.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects tampered models before calling an upstream provider', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'openai',
        model: 'unsupported-model',
        apiKey: 'sk-user-owned',
        request: sentenceRequest,
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.readJson()).toEqual({ error: 'Unsupported model for the selected provider.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed request fields before calling an upstream provider', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKey: 'sk-user-owned',
        request: { ...sentenceRequest, context: 'Untrusted context' },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.readJson()).toEqual({ error: 'Translation request payload is invalid.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects oversized request bodies before parsing them', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest({
        provider: 'openai',
        model: 'gpt-5.4-mini',
        apiKey: 'sk-user-owned',
        request: { ...sentenceRequest, sourceText: 'a'.repeat(70_000) },
      }),
      res,
    );

    expect(res.statusCode).toBe(413);
    expect(res.readJson()).toEqual({ error: 'Translation request body is too large.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects browser requests from another origin', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest(
        {
          provider: 'openai',
          model: 'gpt-5.4-mini',
          apiKey: 'sk-user-owned',
          request: sentenceRequest,
        },
        {
          headers: {
            host: 'worven.example',
            origin: 'https://attacker.example',
          },
        },
      ),
      res,
    );

    expect(res.statusCode).toBe(403);
    expect(res.readJson()).toEqual({
      error: 'Cross-origin translation requests are not allowed.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports same-origin preflight without a wildcard origin', async () => {
    const res = createResponse();

    await handleTranslateApi(
      createRequest(
        {},
        {
          method: 'OPTIONS',
          headers: {
            host: 'worven.example',
            origin: 'https://worven.example',
          },
        },
      ),
      res,
    );

    expect(res.statusCode).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://worven.example');
  });
});
