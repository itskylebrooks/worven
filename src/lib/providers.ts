import type {
  ProviderId,
  SentenceTranslationPayload,
  TranslationRequest,
  WordTranslationPayload,
} from '../types';

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

  let data:
    | {
        result?: WordTranslationPayload | SentenceTranslationPayload;
        error?: string;
      }
    | null = null;

  try {
    data = (await response.json()) as {
      result?: WordTranslationPayload | SentenceTranslationPayload;
      error?: string;
    };
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
