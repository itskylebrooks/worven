import { parseJsonObject } from '../../lib/json.js';
import { buildTranslationPrompts } from '../../lib/prompts.js';
import type { TranslationRequest } from '../../types.js';
import { createProviderRefusalError, createProviderResponseError } from './errors.js';
import { getOutputSchemaName, PROVIDER_TIMEOUT_MS } from './shared.js';
import type { RawTranslationPayload } from './types.js';

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
        if (
          content.type === 'refusal' &&
          'refusal' in content &&
          typeof content.refusal === 'string'
        ) {
          throw createProviderRefusalError('openai');
        }

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

export async function callOpenAI(
  apiKey: string,
  model: string,
  request: TranslationRequest,
): Promise<RawTranslationPayload> {
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
      ...(model.startsWith('gpt-5.6-') ? { reasoning: { effort: 'low' } } : {}),
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
    throw await createProviderResponseError('openai', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractOpenAIText(data));
}
