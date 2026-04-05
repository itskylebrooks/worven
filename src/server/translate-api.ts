import { parseJsonObject } from '../lib/json.js';
import { buildTranslationPrompts } from '../lib/prompts.js';
import type {
  ProviderId,
  SentenceTranslationPayload,
  TranslationRequest,
  VerbConjugationTable,
  WordTranslationPayload,
} from '../types.js';

type RawTranslationPayload = WordTranslationPayload | SentenceTranslationPayload;

type TranslateApiInput = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  request: TranslationRequest;
};

type RequestChunk = { toString: (encoding?: string) => string } | string;

function jsonResponse(
  res: {
    statusCode?: number;
    setHeader: (name: string, value: string) => void;
    end: (body?: string) => void;
  },
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readRequestBody(req: {
  body?: unknown;
  on?: (event: string, handler: (chunk?: RequestChunk) => void) => void;
}): Promise<string> {
  if (typeof req.body === 'string') {
    return Promise.resolve(req.body);
  }

  if (req.body instanceof Uint8Array) {
    return Promise.resolve(new TextDecoder().decode(req.body));
  }

  if (req.body instanceof ArrayBuffer) {
    return Promise.resolve(new TextDecoder().decode(new Uint8Array(req.body)));
  }

  if (typeof req.body === 'object' && req.body !== null) {
    return Promise.resolve(JSON.stringify(req.body));
  }

  if (typeof req.on !== 'function') {
    return Promise.resolve('');
  }

  const on = req.on.bind(req);

  return new Promise((resolve, reject) => {
    let data = '';

    on('data', (chunk) => {
      if (typeof chunk === 'undefined') {
        return;
      }

      data += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
    on('end', () => resolve(data));
    on('error', reject);
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

function ensureShape(
  mode: TranslationRequest['mode'],
  payload: RawTranslationPayload,
): WordTranslationPayload | SentenceTranslationPayload {
  if (mode === 'word') {
    const wordPayload = payload as WordTranslationPayload;
    if (
      typeof wordPayload.primary !== 'string' ||
      !Array.isArray(wordPayload.alternatives) ||
      typeof wordPayload.grammar?.notes !== 'string' ||
      typeof wordPayload.pronunciation !== 'string' ||
      !Array.isArray(wordPayload.examples)
    ) {
      throw new Error('The provider response did not match the expected word JSON shape.');
    }

    const primarySplit = splitPrimaryAndFallbackAlternatives(wordPayload.primary);

    const rawAlternatives = wordPayload.alternatives as unknown[];

    const alternatives = rawAlternatives
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
      .concat(primarySplit.fallbackAlternatives.map((term) => ({ term, gloss: '' })))
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) => candidate.term.toLowerCase() === item.term.toLowerCase(),
          ) === index,
      )
      .slice(0, 3);

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
      grammar: { notes: normalizeNoteQuotes(wordPayload.grammar.notes) },
      pronunciation: wordPayload.pronunciation,
      verbConjugation: normalizeVerbConjugation(
        'verbConjugation' in wordPayload ? wordPayload.verbConjugation : null,
      ),
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

function normalizeVerbConjugation(value: unknown): VerbConjugationTable | null {
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
    .filter((row): row is VerbConjugationTable['rows'][number] => row !== null)
    .slice(0, 6);

  if (!title || rows.length === 0) {
    return null;
  }

  return {
    title,
    rows,
  };
}

function normalizeNoteQuotes(notes: string) {
  return notes
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
          name:
            request.mode === 'word'
              ? 'word_translation'
              : request.requestAlternative
                ? 'sentence_translation_with_alternative'
                : 'sentence_translation',
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw await providerError('OpenAI', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractOpenAIText(data));
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
  apiKey: string,
  model: string,
  request: TranslationRequest,
) {
  if (!apiKey.trim()) {
    throw new Error('Add an API key for the selected provider in Settings before translating.');
  }

  let payload: RawTranslationPayload;

  switch (provider) {
    case 'openai':
      payload = await callOpenAI(apiKey, model, request);
      break;
    case 'anthropic':
      payload = await callAnthropic(apiKey, model, request);
      break;
    case 'gemini':
      payload = await callGemini(apiKey, model, request);
      break;
    default:
      throw new Error(`Unsupported provider: ${String(provider)}`);
  }

  return ensureShape(request.mode, payload);
}

export async function handleTranslateApi(
  req: {
    method?: string;
    url?: string;
    body?: unknown;
    on?: (event: string, handler: (chunk?: RequestChunk) => void) => void;
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
    const body = JSON.parse(rawBody) as TranslateApiInput;

    const result = await translateWithProvider(
      body.provider,
      body.apiKey,
      body.model,
      body.request,
    );

    jsonResponse(res, 200, { result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Translation failed for an unknown reason.';
    jsonResponse(res, 500, { error: message });
  }

  return true;
}
