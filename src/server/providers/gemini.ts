import { parseJsonObject } from '../../lib/json.js';
import { buildTranslationPrompts } from '../../lib/prompts.js';
import type { TranslationRequest } from '../../types.js';
import { createProviderResponseError } from './errors.js';
import { PROVIDER_TIMEOUT_MS } from './shared.js';
import type { RawTranslationPayload } from './types.js';

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
          content?: { parts?: Array<{ text?: string }> };
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

export async function callGemini(
  apiKey: string,
  model: string,
  request: TranslationRequest,
): Promise<RawTranslationPayload> {
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
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: outputSchema,
        },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw await createProviderResponseError('gemini', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractGeminiText(data));
}
