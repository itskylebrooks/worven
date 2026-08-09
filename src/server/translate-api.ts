import { isTranslationRequest } from '../lib/translation-contract.js';
import { isAllowedModel, isProviderId } from '../lib/provider-config.js';
import {
  callProvider,
  normalizeProviderFailure,
  ProviderError,
} from './providers/index.js';
import { normalizeTranslationResult } from './normalize-result.js';
import type { ProviderId, TranslationRequest } from '../types.js';

type TranslateApiInput = {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  request: TranslationRequest;
};

type RequestChunk = { toString: (encoding?: string) => string } | string;
type RequestHeaders = Headers | Record<string, string | string[] | undefined> | undefined;

const MAX_SOURCE_TEXT_LENGTH = 20_000;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;

class ApiError extends Error {
  status: number;
  responseHeaders?: Record<string, string>;

  constructor(status: number, message: string, responseHeaders?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.responseHeaders = responseHeaders;
  }
}

function jsonResponse(
  res: {
    statusCode?: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
  },
  status: number,
  body: unknown,
  headers?: Record<string, string>,
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [name, value] of Object.entries(headers ?? {})) {
    res.setHeader(name, value);
  }
  res.end(JSON.stringify(body));
}

function readRequestBody(req: {
  body?: unknown;
  on?: (event: string, handler: (chunk?: RequestChunk) => void) => void;
}): Promise<string> {
  const ensureAllowedSize = (body: string) => {
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new ApiError(413, 'Translation request body is too large.');
    }

    return body;
  };

  if (typeof req.body === 'string') {
    return Promise.resolve(ensureAllowedSize(req.body));
  }

  if (req.body instanceof Uint8Array) {
    if (req.body.byteLength > MAX_REQUEST_BODY_BYTES) {
      return Promise.reject(new ApiError(413, 'Translation request body is too large.'));
    }

    return Promise.resolve(new TextDecoder().decode(req.body));
  }

  if (req.body instanceof ArrayBuffer) {
    if (req.body.byteLength > MAX_REQUEST_BODY_BYTES) {
      return Promise.reject(new ApiError(413, 'Translation request body is too large.'));
    }

    return Promise.resolve(new TextDecoder().decode(new Uint8Array(req.body)));
  }

  if (typeof req.body === 'object' && req.body !== null) {
    return Promise.resolve(ensureAllowedSize(JSON.stringify(req.body)));
  }

  if (typeof req.on !== 'function') {
    return Promise.resolve('');
  }

  const on = req.on.bind(req);

  return new Promise((resolve, reject) => {
    let data = '';
    let receivedBytes = 0;
    let settled = false;

    on('data', (chunk) => {
      if (settled || typeof chunk === 'undefined') {
        return;
      }

      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      receivedBytes += new TextEncoder().encode(text).byteLength;

      if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
        settled = true;
        reject(new ApiError(413, 'Translation request body is too large.'));
        return;
      }

      data += text;
    });
    on('end', () => {
      if (!settled) {
        settled = true;
        resolve(data);
      }
    });
    on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function pathnameMatches(url: string | undefined, expectedPath: string) {
  if (!url) {
    return false;
  }

  try {
    return new URL(url, 'http://localhost').pathname === expectedPath;
  } catch {
    return url === expectedPath;
  }
}

function getHeaderValue(headers: RequestHeaders, name: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  const directValue = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(directValue)) {
    return directValue[0] ?? null;
  }

  return typeof directValue === 'string' ? directValue : null;
}

function isAllowedRequestOrigin(headers: RequestHeaders): boolean {
  const origin = getHeaderValue(headers, 'origin');
  if (!origin) {
    return true;
  }

  const host =
    getHeaderValue(headers, 'x-forwarded-host') ?? getHeaderValue(headers, 'host');
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function parseTranslateApiInput(value: unknown): TranslateApiInput {
  if (typeof value !== 'object' || value === null) {
    throw new ApiError(400, 'Translation request body must be a JSON object.');
  }

  const candidate = value as Record<string, unknown>;
  const provider = candidate.provider;
  const model = candidate.model;
  const request = candidate.request;

  if (!isProviderId(provider)) {
    throw new ApiError(400, 'Unsupported provider.');
  }

  if (typeof model !== 'string' || !isAllowedModel(provider, model)) {
    throw new ApiError(400, 'Unsupported model for the selected provider.');
  }

  if (typeof request !== 'object' || request === null) {
    throw new ApiError(400, 'Translation request payload is missing.');
  }

  if (!isTranslationRequest(request)) {
    throw new ApiError(400, 'Translation request payload is invalid.');
  }

  const translationRequest = request;
  const sourceTextLength = translationRequest.sourceText.trim().length;
  if (sourceTextLength === 0) {
    throw new ApiError(400, 'Translation request must include source text.');
  }

  if (sourceTextLength > MAX_SOURCE_TEXT_LENGTH) {
    throw new ApiError(
      400,
      `Translation requests are limited to ${MAX_SOURCE_TEXT_LENGTH} characters of source text.`,
    );
  }

  return {
    provider,
    model,
    request: translationRequest,
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : undefined,
  };
}

function resolveProviderApiKey(apiKey: string | undefined) {
  if (!apiKey?.trim()) {
    throw new ApiError(400, 'Add an API key for the selected provider in Settings before translating.');
  }

  return apiKey.trim();
}

async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest,
) {
  const resolvedApiKey = resolveProviderApiKey(apiKey);
  const payload = await callProvider(provider, resolvedApiKey, model, request);

  try {
    return normalizeTranslationResult(request, payload);
  } catch (error) {
    throw normalizeProviderFailure(provider, error);
  }
}

export async function handleTranslateApi(
  req: {
    method?: string;
    url?: string;
    body?: unknown;
    on?: (event: string, handler: (chunk?: RequestChunk) => void) => void;
    headers?: RequestHeaders;
    socket?: { remoteAddress?: string | null };
  },
  res: {
    statusCode?: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
  },
) {
  if (!pathnameMatches(req.url, '/api/translate')) {
    return false;
  }

  if (!isAllowedRequestOrigin(req.headers)) {
    jsonResponse(res, 403, { error: 'Cross-origin translation requests are not allowed.' });
    return true;
  }

  const requestOrigin = getHeaderValue(req.headers, 'origin');
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== 'POST') {
    jsonResponse(res, 405, { error: 'Method not allowed.' });
    return true;
  }

  try {
    const rawBody = await readRequestBody(req);
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ApiError(400, 'Translation request body must be valid JSON.');
    }

    const body = parseTranslateApiInput(parsedBody);

    const result = await translateWithProvider(
      body.provider,
      body.apiKey,
      body.model,
      body.request,
    );

    jsonResponse(res, 200, { result });
  } catch (error) {
    if (error instanceof ApiError) {
      jsonResponse(res, error.status, { error: error.message }, error.responseHeaders);
      return true;
    }

    if (error instanceof ProviderError) {
      jsonResponse(res, error.status, { error: error.message }, error.responseHeaders);
      return true;
    }

    const message =
      error instanceof Error ? error.message : 'Translation failed for an unknown reason.';
    jsonResponse(res, 500, { error: message });
  }

  return true;
}
