import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  HISTORY_STORAGE_KEY,
  HISTORY_STORAGE_VERSION,
  addHistoryItem,
  loadHistory,
} from './history';

describe('history payload normalization', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        clear: () => {
          storage.clear();
        },
      },
    });
  });

  afterEach(() => {
    storage.clear();
  });

  it('keeps legacy word entries that do not yet include verb conjugation data', () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-word',
          createdAt: '2026-04-05T10:00:00.000Z',
          sourceText: 'gehen',
          result: {
            mode: 'word',
            sourceText: 'gehen',
            data: {
              primary: 'to go',
              alternatives: [
                { term: 'to walk', gloss: 'gehen' },
                { term: 'to travel', gloss: 'reisen' },
                { term: 'to leave', gloss: 'abfahren' },
              ],
              grammar: {
                notes: 'Verb.',
              },
              pronunciation: 'gayn',
              examples: [
                { source: 'Ich gehe.', target: 'I am going.' },
                { source: 'Geh jetzt.', target: 'Go now.' },
                { source: 'Wir gehen morgen.', target: 'We are going tomorrow.' },
              ],
            },
          },
          provider: 'openai',
          model: 'gpt-5.4-mini',
          nativeLanguage: 'English',
          targetLanguage: 'German',
          context: 'General',
          directionMode: 'target_to_native',
        },
      ]),
    );

    const history = loadHistory();

    expect(history).toHaveLength(1);
    expect(history[0]?.result.mode).toBe('word');
    if (history[0]?.result.mode === 'word') {
      expect(history[0].result.data.etymology).toBe('Verb.');
      expect(history[0].result.data.antonyms).toEqual([]);
      expect(history[0].result.data.verbConjugation).toBeNull();
      expect(history[0].result.data.nounCases).toBeNull();
    }
  });

  it('upgrades the previous single-table verb conjugation shape into the new basic structure', () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-conjugation',
          createdAt: '2026-04-05T10:00:00.000Z',
          sourceText: 'gehen',
          result: {
            mode: 'word',
            sourceText: 'gehen',
            data: {
              primary: 'to go',
              alternatives: [
                { term: 'to walk', gloss: 'gehen' },
                { term: 'to travel', gloss: 'reisen' },
                { term: 'to leave', gloss: 'abfahren' },
              ],
              grammar: {
                notes: 'Verb.',
              },
              pronunciation: 'gayn',
              verbConjugation: {
                title: 'Present indicative',
                rows: [
                  { label: 'ich', form: 'gehe' },
                  { label: 'du', form: 'gehst' },
                ],
              },
              examples: [
                { source: 'Ich gehe.', target: 'I am going.' },
                { source: 'Geh jetzt.', target: 'Go now.' },
                { source: 'Wir gehen morgen.', target: 'We are going tomorrow.' },
              ],
            },
          },
          provider: 'openai',
          model: 'gpt-5.4-mini',
          nativeLanguage: 'English',
          targetLanguage: 'German',
          context: 'General',
          directionMode: 'target_to_native',
        },
      ]),
    );

    const history = loadHistory();

    expect(history).toHaveLength(1);
    if (history[0]?.result.mode === 'word') {
      expect(history[0].result.data.etymology).toBe('Verb.');
      expect(history[0].result.data.antonyms).toEqual([]);
      expect(history[0].result.data.verbConjugation).toEqual({
        coverage: 'basic',
        present: [
          {
            title: 'Present indicative',
            rows: [
              { label: 'ich', form: 'gehe' },
              { label: 'du', form: 'gehst' },
            ],
          },
        ],
        past: [],
        future: [],
      });
      expect(history[0].result.data.nounCases).toBeNull();
    }
  });

  it('persists a versioned envelope and rejects invalid domain values', () => {
    const validItem = {
      id: 'valid-entry',
      createdAt: '2026-04-05T10:00:00.000Z',
      sourceText: 'Hello there',
      result: {
        mode: 'sentence' as const,
        sourceText: 'Hello there',
        data: { translation: 'Hallo da', alternative: null },
      },
      provider: 'openai' as const,
      model: 'gpt-5.4-mini',
      nativeLanguage: 'English',
      targetLanguage: 'German',
      context: 'General' as const,
      directionMode: 'source_to_target' as const,
    };

    addHistoryItem(validItem);

    const persisted = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) ?? '{}') as {
      version?: number;
      items?: unknown[];
    };
    expect(persisted.version).toBe(HISTORY_STORAGE_VERSION);
    expect(persisted.items).toHaveLength(1);

    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        version: HISTORY_STORAGE_VERSION,
        items: [{ ...validItem, context: 'Invalid context' }],
      }),
    );
    expect(loadHistory()).toEqual([]);
  });

  it('migrates legacy Groq history metadata to the default private provider', () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-groq-entry',
          createdAt: '2026-04-05T10:00:00.000Z',
          sourceText: 'Hello there',
          result: {
            mode: 'sentence',
            sourceText: 'Hello there',
            data: { translation: 'Hallo da', alternative: null },
          },
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          nativeLanguage: 'English',
          targetLanguage: 'German',
          context: 'General',
          directionMode: 'source_to_target',
        },
      ]),
    );

    expect(loadHistory()[0]).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.4-mini',
    });
  });
});
