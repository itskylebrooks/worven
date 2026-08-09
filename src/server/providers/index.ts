import type { ProviderId, TranslationRequest } from '../../types.js';
import { callAnthropic } from './anthropic.js';
import { callDeepSeek } from './deepseek.js';
import { normalizeProviderFailure } from './errors.js';
import { callGemini } from './gemini.js';
import { callOpenAI } from './openai.js';
import type { RawTranslationPayload } from './types.js';
import { callXAI } from './xai.js';

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
      case 'openai':
        return await callOpenAI(apiKey, model, request);
      case 'anthropic':
        return await callAnthropic(apiKey, model, request);
      case 'gemini':
        return await callGemini(apiKey, model, request);
      case 'deepseek':
        return await callDeepSeek(apiKey, model, request);
      case 'xai':
        return await callXAI(apiKey, model, request);
    }
  } catch (error) {
    throw normalizeProviderFailure(provider, error);
  }
}
