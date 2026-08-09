import { describe, expect, it } from 'vitest';
import {
  isTranslationApiResultForRequest,
  isTranslationRequest,
} from './translation-contract';
import type { TranslationRequest } from '../types';

const sentenceRequest: TranslationRequest = {
  sourceText: 'Hello',
  targetLanguage: 'German',
  nativeLanguage: 'English',
  context: 'General',
  mode: 'sentence',
};

describe('translation runtime contracts', () => {
  it('accepts a supported translation request', () => {
    expect(isTranslationRequest(sentenceRequest)).toBe(true);
  });

  it('rejects invalid request combinations and domain values', () => {
    expect(
      isTranslationRequest({
        ...sentenceRequest,
        context: 'Untrusted context',
      }),
    ).toBe(false);
    expect(
      isTranslationRequest({
        ...sentenceRequest,
        requestVerbConjugationExpansion: true,
      }),
    ).toBe(false);
  });

  it('validates the complete response shape for the requested operation', () => {
    expect(
      isTranslationApiResultForRequest(sentenceRequest, {
        translation: 'Hallo',
        alternative: null,
      }),
    ).toBe(true);
    expect(
      isTranslationApiResultForRequest(
        {
          ...sentenceRequest,
          mode: 'word',
          requestVerbConjugationExpansion: true,
        },
        { verbConjugation: { coverage: 'full' } },
      ),
    ).toBe(false);
  });
});
