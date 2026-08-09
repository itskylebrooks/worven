import type { ProviderId, TranslationRequest } from '../../types.js';
import { callAnthropic } from './anthropic.js';
import { normalizeProviderFailure } from './errors.js';
import { callGemini } from './gemini.js';
import { callGroq } from './groq.js';
import { callOpenAI } from './openai.js';
import type { RawTranslationPayload } from './types.js';

export { normalizeProviderFailure, ProviderError } from './errors.js';
export type { RawTranslationPayload } from './types.js';

export async function callProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  request: TranslationRequest,
): Promise<RawTranslationPayload> {
  try {
    switch (provider) {
      case 'groq':
        return await callGroq(apiKey, model, request);
      case 'openai':
        return await callOpenAI(apiKey, model, request);
      case 'anthropic':
        return await callAnthropic(apiKey, model, request);
      case 'gemini':
        return await callGemini(apiKey, model, request);
    }
  } catch (error) {
    throw normalizeProviderFailure(provider, error);
  }
}
