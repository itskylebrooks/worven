import { parseJsonObject } from '../../lib/json.js';
import { buildTranslationPrompts } from '../../lib/prompts.js';
import type { TranslationRequest } from '../../types.js';
import { createProviderResponseError, ProviderError } from './errors.js';
import { getOutputSchemaName, PROVIDER_TIMEOUT_MS } from './shared.js';
import type { RawTranslationPayload } from './types.js';

const STRICT_JSON_SCHEMA_MODELS = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);

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
      throw new ProviderError(422, message.refusal.trim());
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

export async function callGroq(
  apiKey: string,
  model: string,
  request: TranslationRequest,
): Promise<RawTranslationPayload> {
  const { systemPrompt, userPrompt, outputSchema } = buildTranslationPrompts(request);
  const responseFormat = STRICT_JSON_SCHEMA_MODELS.has(model)
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: responseFormat,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await createProviderResponseError('groq', response);
  }

  const data = (await response.json()) as unknown;
  return parseJsonObject<RawTranslationPayload>(extractGroqText(data));
}
