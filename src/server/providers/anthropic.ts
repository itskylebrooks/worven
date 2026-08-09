import { parseJsonObject } from '../../lib/json.js';
import { buildTranslationPrompts } from '../../lib/prompts.js';
import type { TranslationRequest } from '../../types.js';
import { createProviderRefusalError, createProviderResponseError } from './errors.js';
import { PROVIDER_TIMEOUT_MS } from './shared.js';
import type { RawTranslationPayload } from './types.js';

function extractAnthropicText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'stop_reason' in data &&
    (data as { stop_reason?: unknown }).stop_reason === 'refusal'
  ) {
    throw createProviderRefusalError('anthropic');
  }

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

export async function callAnthropic(
  apiKey: string,
  model: string,
  request: TranslationRequest,
): Promise<RawTranslationPayload> {
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
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: {
        ...(model.endsWith('-5') ? { effort: 'low' } : {}),
        format: {
          type: 'json_schema',
          schema: outputSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await createProviderResponseError('anthropic', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractAnthropicText(data));
}
