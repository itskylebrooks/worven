import type {
  ProviderId,
  SentenceTranslationPayload,
  TranslationRequest,
  VerbConjugationExpansionPayload,
  WordTranslationPayload,
} from '../types';
import {
  isTranslationApiResultForRequest,
  type TranslationApiResult,
} from './translation-contract';

interface TranslateApiResponse {
  result?: unknown;
  error?: string;
}

function parseTranslateApiResponse(value: unknown): TranslateApiResponse | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const error = typeof candidate.error === 'string' ? candidate.error : undefined;

  return { result: candidate.result, error };
}

export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest & { mode: 'word'; requestVerbConjugationExpansion: true },
): Promise<VerbConjugationExpansionPayload>;
export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest & { mode: 'word' },
): Promise<WordTranslationPayload>;
export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest & { mode: 'sentence' },
): Promise<SentenceTranslationPayload>;
export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest,
): Promise<TranslationApiResult>;
export async function translateWithProvider(
  provider: ProviderId,
  apiKey: string | undefined,
  model: string,
  request: TranslationRequest,
): Promise<TranslationApiResult> {
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

  if (!isTranslationApiResultForRequest(request, data?.result)) {
    throw new Error('Translation response did not match the expected shape.');
  }

  return data.result;
}
