export type ProviderId = 'openai' | 'anthropic' | 'gemini';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TranslationMode = 'word' | 'sentence';
export type TranslationContext =
  | 'General'
  | 'Formal'
  | 'Legal'
  | 'Medical'
  | 'Technical'
  | 'Casual'
  | 'Literary';

export interface WordUsageExample {
  source: string;
  target: string;
}

export interface WordTranslationPayload {
  primary: string;
  alternatives: string[];
  grammar: {
    notes: string;
  };
  pronunciation: string;
  examples: WordUsageExample[];
}

export interface SentenceTranslationPayload {
  translation: string;
  alternative: string | null;
}

export interface TranslationRequest {
  sourceText: string;
  targetLanguage: string;
  nativeLanguage: string;
  context: TranslationContext;
  mode: TranslationMode;
  requestAlternative?: boolean;
}

export interface AppSettings {
  provider: ProviderId;
  model: string;
  apiKeys: Record<ProviderId, string>;
  nativeLanguage: string;
  targetLanguage: string;
  translationContext: TranslationContext;
  themeMode: ThemeMode;
}

export type TranslationResult =
  | {
      mode: 'word';
      data: WordTranslationPayload;
      sourceText: string;
    }
  | {
      mode: 'sentence';
      data: SentenceTranslationPayload;
      sourceText: string;
    };
