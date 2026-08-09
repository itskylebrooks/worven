import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';
import { buildTranslationRequest } from './translation-request';

describe('buildTranslationRequest', () => {
  it('targets the selected foreign language for native-to-foreign requests', () => {
    expect(
      buildTranslationRequest(DEFAULT_SETTINGS, 'source_to_target', {
        sourceText: 'Hello there',
        mode: 'sentence',
        requestAlternative: true,
      }),
    ).toMatchObject({
      targetLanguage: 'German',
      requestAlternative: true,
    });
  });

  it('targets the native language for foreign-to-native alternatives', () => {
    expect(
      buildTranslationRequest(DEFAULT_SETTINGS, 'target_to_native', {
        sourceText: 'Guten Morgen',
        mode: 'sentence',
        requestAlternative: true,
      }),
    ).toMatchObject({
      targetLanguage: 'English',
      requestAlternative: true,
    });
  });

  it('anchors reverse-direction word details to the source language', () => {
    expect(
      buildTranslationRequest(DEFAULT_SETTINGS, 'target_to_native', {
        sourceText: 'gehen',
        mode: 'word',
        requestVerbConjugationExpansion: true,
      }),
    ).toMatchObject({
      targetLanguage: 'English',
      detailFocus: 'source',
      sourceLanguageHint: 'German',
      requestVerbConjugationExpansion: true,
    });
  });
});
