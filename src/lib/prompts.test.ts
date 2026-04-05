import { describe, expect, it } from 'vitest';
import { buildTranslationPrompts } from './prompts';

describe('buildTranslationPrompts', () => {
  it('anchors word pronunciation to the translated foreign-language term for native-to-foreign lookups', () => {
    const prompt = buildTranslationPrompts({
      sourceText: 'go',
      targetLanguage: 'German',
      nativeLanguage: 'English',
      context: 'General',
      mode: 'word',
      detailFocus: 'target',
      sourceLanguageHint: 'English',
    });

    expect(prompt.systemPrompt).toContain(
      'The foreign-language term being learned is the translated output in German, not the user\'s source text.',
    );
    expect(prompt.userPrompt).toContain('Foreign-language term location: translated output');
    expect(prompt.userPrompt).toContain(
      '"pronunciation" must always be for the foreign-language term in German, never for the native-language translation or whichever UI column is labeled "Source".',
    );
    expect(prompt.userPrompt).not.toContain('detailFocus');
  });

  it('anchors word pronunciation to the foreign source term for foreign-to-native lookups', () => {
    const prompt = buildTranslationPrompts({
      sourceText: 'gehen',
      targetLanguage: 'English',
      nativeLanguage: 'English',
      context: 'General',
      mode: 'word',
      detailFocus: 'source',
      sourceLanguageHint: 'German',
    });

    expect(prompt.systemPrompt).toContain(
      'The foreign-language term being learned is the source text in German, not the native-language translation output.',
    );
    expect(prompt.userPrompt).toContain('Foreign-language term location: source text');
    expect(prompt.userPrompt).toContain(
      '- If the foreign-language term is the source text, keep all word details anchored to the source German term the user entered.',
    );
    expect(prompt.userPrompt).not.toContain('detailFocus');
  });
});
