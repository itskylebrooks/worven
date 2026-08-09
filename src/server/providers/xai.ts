import { parseJsonObject } from '../../lib/json.js';
import { buildTranslationPrompts } from '../../lib/prompts.js';
import type { TranslationRequest } from '../../types.js';
import { createProviderResponseError } from './errors.js';
import { getOutputSchemaName, PROVIDER_TIMEOUT_MS } from './shared.js';
import type { RawTranslationPayload } from './types.js';

function extractXAIText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'choices' in data &&
    Array.isArray((data as { choices?: unknown[] }).choices)
  ) {
    const content = (data as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]
      ?.message?.content;

    if (typeof content === 'string' && content.trim()) {
      return content;
    }
  }

  throw new Error('xAI did not return text output.');
}

export async function callXAI(
  apiKey: string,
  model: string,
  request: TranslationRequest,
): Promise<RawTranslationPayload> {
  const { systemPrompt, userPrompt, outputSchema } = buildTranslationPrompts(request);
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: getOutputSchemaName(request),
          schema: outputSchema,
          strict: true,
        },
      },
      reasoning_effort: 'low',
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await createProviderResponseError('xai', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractXAIText(data));
}
