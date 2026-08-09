import { parseJsonObject } from '../lib/json.js';
import { isTranslationRequest } from '../lib/translation-contract.js';
import {
  isAllowedModel,
  isProviderId,
  providerUsesClientKey,
  providerUsesServerKey,
} from '../lib/provider-config.js';
import { buildTranslationPrompts } from '../lib/prompts.js';
import type {
  NounCaseData,
  NounCaseTable,
  ProviderId,
  SentenceTranslationPayload,
  TranslationRequest,
  VerbConjugationCoverage,
  VerbConjugationData,
  VerbConjugationExpansionPayload,
  VerbConjugationTable,
  WordTranslationPayload,
} from '../types.js';

type RawTranslationPayload =
  | WordTranslationPayload
  | SentenceTranslationPayload
  | VerbConjugationExpansionPayload;

type TranslateApiInput = {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  request: TranslationRequest;
};

type RequestChunk = { toString: (encoding?: string) => string } | string;
type RequestHeaders = Headers | Record<string, string | string[] | undefined> | undefined;

const MAX_GROQ_SOURCE_TEXT_LENGTH = 5000;
const MAX_SOURCE_TEXT_LENGTH = 20_000;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const PROVIDER_TIMEOUT_MS = 30_000;
const GROQ_RATE_LIMIT_MAX_REQUESTS = 20;
const GROQ_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const groqRateLimitState = new Map<string, { count: number; resetAt: number }>();
const GROQ_STRICT_JSON_SCHEMA_MODELS = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);

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

function getOutputSchemaName(request: TranslationRequest) {
  if (request.mode === 'word') {
    return request.requestVerbConjugationExpansion
      ? 'word_conjugation_expansion'
      : 'word_translation';
  }

  return request.requestAlternative
    ? 'sentence_translation_with_alternative'
    : 'sentence_translation';
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

function getRequestIp(req: {
  headers?: RequestHeaders;
  socket?: { remoteAddress?: string | null };
}): string {
  const forwardedFor = getHeaderValue(req.headers, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = getHeaderValue(req.headers, 'x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return req.socket?.remoteAddress?.trim() || 'unknown';
}

function enforceGroqRateLimit(req: {
  headers?: RequestHeaders;
  socket?: { remoteAddress?: string | null };
}) {
  const ip = getRequestIp(req);
  const now = Date.now();
  const existing = groqRateLimitState.get(ip);

  if (!existing || existing.resetAt <= now) {
    groqRateLimitState.set(ip, {
      count: 1,
      resetAt: now + GROQ_RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (existing.count >= GROQ_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new ApiError(429, 'Too many Groq translation requests. Please try again shortly.', {
      'Retry-After': String(retryAfterSeconds),
    });
  }

  existing.count += 1;
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

  if (
    provider === 'groq' &&
    sourceTextLength > MAX_GROQ_SOURCE_TEXT_LENGTH
  ) {
    throw new ApiError(
      400,
      `Groq requests are limited to ${MAX_GROQ_SOURCE_TEXT_LENGTH} characters of source text.`,
    );
  }

  return {
    provider,
    model,
    request: translationRequest,
    apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey : undefined,
  };
}

function resolveProviderApiKey(provider: ProviderId, apiKey: string | undefined) {
  if (providerUsesServerKey(provider)) {
    const groqApiKey = process.env.GROQ_API_KEY?.trim();
    if (!groqApiKey) {
      throw new ApiError(
        500,
        'Groq is not configured on the server. Add GROQ_API_KEY to your environment variables.',
      );
    }

    return groqApiKey;
  }

  if (providerUsesClientKey(provider) && !apiKey?.trim()) {
    throw new ApiError(400, 'Add an API key for the selected provider in Settings before translating.');
  }

  return apiKey?.trim() ?? '';
}

function ensureShape(
  request: TranslationRequest,
  payload: RawTranslationPayload,
): RawTranslationPayload {
  if (request.mode === 'word' && request.requestVerbConjugationExpansion) {
    const verbPayload = payload as VerbConjugationExpansionPayload;

    return {
      verbConjugation: normalizeVerbConjugation(verbPayload.verbConjugation, 'full'),
    };
  }

  if (request.mode === 'word') {
    const wordPayload = payload as WordTranslationPayload;
    const legacyGrammar = 'grammar' in wordPayload ? wordPayload.grammar : null;
    const etymology =
      typeof wordPayload.etymology === 'string'
        ? wordPayload.etymology
        : typeof legacyGrammar === 'object' &&
            legacyGrammar !== null &&
            typeof (legacyGrammar as { notes?: unknown }).notes === 'string'
          ? (legacyGrammar as { notes: string }).notes
          : null;

    if (
      typeof wordPayload.primary !== 'string' ||
      !Array.isArray(wordPayload.alternatives) ||
      typeof etymology !== 'string' ||
      typeof wordPayload.pronunciation !== 'string' ||
      !Array.isArray(wordPayload.examples)
    ) {
      throw new Error('The provider response did not match the expected word JSON shape.');
    }

    const primarySplit = splitPrimaryAndFallbackAlternatives(wordPayload.primary);
    const alternatives = normalizeWordRelations(
      wordPayload.alternatives,
      primarySplit.fallbackAlternatives,
    );
    const antonyms = normalizeWordRelations(
      'antonyms' in wordPayload ? wordPayload.antonyms : [],
    );

    const examples = wordPayload.examples
      .filter(
        (example): example is WordTranslationPayload['examples'][number] =>
          typeof example === 'object' &&
          example !== null &&
          typeof example.source === 'string' &&
          typeof example.target === 'string',
      )
      .slice(0, 3);

    return {
      primary: primarySplit.primary,
      alternatives,
      antonyms,
      etymology: normalizeTextQuotes(etymology),
      pronunciation: wordPayload.pronunciation,
      verbConjugation: normalizeVerbConjugation(
        'verbConjugation' in wordPayload ? wordPayload.verbConjugation : null,
        'basic',
      ),
      nounCases: normalizeNounCases('nounCases' in wordPayload ? wordPayload.nounCases : null),
      examples,
    };
  }

  const sentencePayload = payload as SentenceTranslationPayload;
  if (
    typeof sentencePayload.translation !== 'string' ||
    !(typeof sentencePayload.alternative === 'string' || sentencePayload.alternative === null)
  ) {
    throw new Error('The provider response did not match the expected sentence JSON shape.');
  }

  return sentencePayload;
}

function normalizeWordRelations(
  value: unknown,
  fallbackTerms: string[] = [],
): WordTranslationPayload['alternatives'] {
  const items = Array.isArray(value) ? value : [];

  return items
    .map((item) => {
      if (typeof item === 'string') {
        return {
          term: item.trim(),
          gloss: '',
        };
      }

      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { term?: unknown }).term === 'string' &&
        typeof (item as { gloss?: unknown }).gloss === 'string'
      ) {
        return item as WordTranslationPayload['alternatives'][number];
      }

      if (
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { target?: unknown }).target === 'string' &&
        typeof (item as { source?: unknown }).source === 'string'
      ) {
        return {
          term: ((item as { target: string }).target || '').trim(),
          gloss: ((item as { source: string }).source || '').trim(),
        };
      }

      return null;
    })
    .filter(
      (item): item is WordTranslationPayload['alternatives'][number] =>
        item !== null && item.term.trim().length > 0,
    )
    .concat(fallbackTerms.map((term) => ({ term, gloss: '' })))
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.term.toLowerCase() === item.term.toLowerCase()) ===
        index,
    )
    .slice(0, 3);
}

function normalizeVerbConjugation(
  value: unknown,
  coverage: VerbConjugationCoverage,
): VerbConjugationData | null {
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { title?: unknown }).title === 'string' &&
    Array.isArray((value as { rows?: unknown[] }).rows)
  ) {
    const legacyTable = normalizeVerbConjugationTable(value);
    if (!legacyTable) {
      return null;
    }

    return {
      coverage: 'basic',
      present: [legacyTable],
      past: [],
      future: [],
    };
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const present = normalizeVerbConjugationTables((value as { present?: unknown }).present);
  const past = normalizeVerbConjugationTables((value as { past?: unknown }).past);
  const future = normalizeVerbConjugationTables((value as { future?: unknown }).future);

  if (coverage === 'basic') {
    if (present.length === 0) {
      return null;
    }

    return {
      coverage: 'basic',
      present: present.slice(0, 1),
      past: [],
      future: [],
    };
  }

  if (present.length === 0 && past.length === 0 && future.length === 0) {
    return null;
  }

  return {
    coverage: 'full',
    present,
    past,
    future,
  };
}

function normalizeNounCases(value: unknown): NounCaseData | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const tables = normalizeNounCaseTables((value as { tables?: unknown }).tables);

  if (tables.length === 0) {
    return null;
  }

  return { tables };
}

function normalizeVerbConjugationTables(value: unknown): VerbConjugationTable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((table) => normalizeVerbConjugationTable(table))
    .filter((table): table is VerbConjugationTable => table !== null)
    .slice(0, 4);
}

function normalizeNounCaseTables(value: unknown): NounCaseTable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((table) => normalizeNounCaseTable(table))
    .filter((table): table is NounCaseTable => table !== null)
    .slice(0, 3);
}

function normalizeVerbConjugationTable(value: unknown): VerbConjugationTable | null {
  const normalized = normalizeLabeledFormTable(value, 6);
  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeNounCaseTable(value: unknown): NounCaseTable | null {
  const normalized = normalizeLabeledFormTable(value, 8);
  if (!normalized) {
    return null;
  }

  return normalized;
}

function normalizeLabeledFormTable(
  value: unknown,
  maxRows: number,
): { title: string; rows: Array<{ label: string; form: string }> } | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const title =
    typeof (value as { title?: unknown }).title === 'string'
      ? (value as { title: string }).title.trim()
      : '';
  const rawRows = Array.isArray((value as { rows?: unknown[] }).rows)
    ? ((value as { rows: unknown[] }).rows ?? [])
    : [];
  const rows = rawRows
    .map((row) => {
      if (typeof row !== 'object' || row === null) {
        return null;
      }

      const label =
        typeof (row as { label?: unknown }).label === 'string'
          ? (row as { label: string }).label.trim()
          : '';
      const form =
        typeof (row as { form?: unknown }).form === 'string'
          ? (row as { form: string }).form.trim()
          : '';

      if (!label || !form) {
        return null;
      }

      return { label, form };
    })
    .filter((row): row is Array<{ label: string; form: string }>[number] => row !== null)
    .slice(0, maxRows);

  if (!title || rows.length === 0) {
    return null;
  }

  return {
    title,
    rows,
  };
}

function normalizeTextQuotes(text: string) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/‘([^’]+)’/g, '"$1"')
    .replace(/'([^']+)'/g, '"$1"')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPrimaryAndFallbackAlternatives(primary: string) {
  const normalized = primary.replace(/\s+/g, ' ').trim();
  const pieces = normalized
    .split(/\s*(?:,|;|\/|\|)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const looksLikeList =
    pieces.length > 1 &&
    pieces.length <= 5 &&
    pieces.every((item) => item.split(/\s+/).length <= 4);

  if (!looksLikeList) {
    return {
      primary: normalized,
      fallbackAlternatives: [] as string[],
    };
  }

  return {
    primary: pieces[0],
    fallbackAlternatives: pieces.slice(1),
  };
}

function extractOpenAIText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'output_text' in data &&
    typeof (data as { output_text?: unknown }).output_text === 'string'
  ) {
    return (data as { output_text: string }).output_text;
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'output' in data &&
    Array.isArray((data as { output?: unknown[] }).output)
  ) {
    const output = (
      data as { output: Array<{ content?: Array<{ text?: string; type?: string }> }> }
    ).output;
    const chunks: string[] = [];

    for (const item of output) {
      if (!Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (content.type === 'output_text' && typeof content.text === 'string') {
          chunks.push(content.text);
        }
      }
    }

    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }

  throw new Error('OpenAI did not return text output.');
}

function extractAnthropicText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'content' in data &&
    Array.isArray((data as { content?: unknown[] }).content)
  ) {
    const blocks = (data as { content: Array<{ text?: string; type?: string }> }).content;
    const textBlock = blocks.find(
      (block) => block.type === 'text' && typeof block.text === 'string',
    );

    if (textBlock?.text) {
      return textBlock.text;
    }
  }

  throw new Error('Anthropic did not return text output.');
}

function extractGeminiText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'candidates' in data &&
    Array.isArray((data as { candidates?: unknown[] }).candidates)
  ) {
    const candidates = (
      data as {
        candidates: Array<{
          content?: {
            parts?: Array<{
              text?: string;
            }>;
          };
        }>;
      }
    ).candidates;
    const firstText = candidates[0]?.content?.parts?.[0]?.text;

    if (typeof firstText === 'string') {
      return firstText;
    }
  }

  throw new Error('Gemini did not return text output.');
}

function extractGroqText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as { choices?: unknown[] }).choices)
  ) {
    const firstChoice = (
      data as {
        choices: Array<{
          message?: {
            content?: string | Array<{ text?: string; type?: string }>;
            refusal?: string | null;
          };
        }>;
      }
    ).choices[0];
    const message = firstChoice?.message;

    if (typeof message?.refusal === 'string' && message.refusal.trim()) {
      throw new Error(message.refusal.trim());
    }

    if (typeof message?.content === 'string') {
      return message.content;
    }

    if (Array.isArray(message?.content)) {
      const text = message.content
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('\n')
        .trim();

      if (text) {
        return text;
      }
    }
  }

  throw new Error('Groq did not return text output.');
}

async function providerError(providerName: string, response: Response) {
  const fallbackMessage = `${providerName} request failed with status ${response.status}.`;

  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };

    return new Error(data.error?.message ?? data.message ?? fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

async function callOpenAI(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt, outputSchema } = buildTranslationPrompts(request);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      text: {
        format: {
          type: 'json_schema',
          name: getOutputSchemaName(request),
          strict: true,
          schema: outputSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await providerError('OpenAI', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractOpenAIText(data));
}

async function callGroq(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt, outputSchema } = buildTranslationPrompts(request);
  const responseFormat = GROQ_STRICT_JSON_SCHEMA_MODELS.has(model)
    ? {
        type: 'json_schema',
        json_schema: {
          name: getOutputSchemaName(request),
          strict: true,
          schema: outputSchema,
        },
      }
    : {
        type: 'json_object',
      };
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: responseFormat,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await providerError('Groq', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractGroqText(data));
}

async function callAnthropic(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt, outputSchema } = buildTranslationPrompts(request);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: outputSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await providerError('Anthropic', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractAnthropicText(data));
}

async function callGemini(apiKey: string, model: string, request: TranslationRequest) {
  const { systemPrompt, userPrompt, outputSchema } = buildTranslationPrompts(request);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: outputSchema,
        },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw await providerError('Gemini', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractGeminiText(data));
}

async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest,
) {
  const resolvedApiKey = resolveProviderApiKey(provider, apiKey);

  let payload: RawTranslationPayload;

  switch (provider) {
    case 'groq':
      payload = await callGroq(resolvedApiKey, model, request);
      break;
    case 'openai':
      payload = await callOpenAI(resolvedApiKey, model, request);
      break;
    case 'anthropic':
      payload = await callAnthropic(resolvedApiKey, model, request);
      break;
    case 'gemini':
      payload = await callGemini(resolvedApiKey, model, request);
      break;
    default:
      throw new Error(`Unsupported provider: ${String(provider)}`);
  }

  return ensureShape(request, payload);
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

  res.setHeader('Access-Control-Allow-Origin', '*');
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

    if (body.provider === 'groq') {
      enforceGroqRateLimit(req);
    }

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

    const message =
      error instanceof Error ? error.message : 'Translation failed for an unknown reason.';
    jsonResponse(res, 500, { error: message });
  }

  return true;
}
