import type {
  ProviderId,
  SentenceTranslationPayload,
  TranslationRequest,
  WordTranslationPayload,
} from '../types';

type TranslateApiResult = WordTranslationPayload | SentenceTranslationPayload;

interface TranslateApiResponse {
  result?: TranslateApiResult;
  error?: string;
}

function isTranslateApiResult(value: unknown): value is TranslateApiResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if ('primary' in value) {
    return typeof value.primary === 'string';
  }

  return 'translation' in value && typeof value.translation === 'string';
}

function parseTranslateApiResponse(value: unknown): TranslateApiResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const result = isTranslateApiResult(candidate.result) ? candidate.result : undefined;
  const error = typeof candidate.error === 'string' ? candidate.error : undefined;

  return { result, error };
}

export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  request: TranslationRequest,
) {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      apiKey,
      model,
      request,
    }),
  });

  let data: TranslateApiResponse | null = null;

  try {
    data = parseTranslateApiResponse(await response.json());
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error ?? `Translation request failed with status ${response.status}.`);
  }

  if (!data?.result) {
    throw new Error('Translation response was empty.');
  }

  return data.result;
}
