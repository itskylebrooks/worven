import type { TranslationRequest } from '../../types.js';

export const PROVIDER_TIMEOUT_MS = 30_000;

export function getOutputSchemaName(request: TranslationRequest) {
  if (request.mode === 'word') {
    return request.requestVerbConjugationExpansion
      ? 'word_conjugation_expansion'
      : 'word_translation';
  }

  return request.requestAlternative
    ? 'sentence_translation_with_alternative'
    : 'sentence_translation';
}
