export type ProviderId = 'groq' | 'openai' | 'anthropic' | 'gemini';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TranslationMode = 'word' | 'sentence';
export type TranslationDirectionMode = 'source_to_target' | 'target_to_native';
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

export interface WordAlternative {
  term: string;
  gloss: string;
}

export interface VerbConjugationRow {
  label: string;
  form: string;
}

export interface VerbConjugationTable {
  title: string;
  rows: VerbConjugationRow[];
}

export type VerbConjugationCoverage = 'basic' | 'full';
export type VerbConjugationTense = 'present' | 'past' | 'future';

export interface VerbConjugationData {
  coverage: VerbConjugationCoverage;
  present: VerbConjugationTable[];
  past: VerbConjugationTable[];
  future: VerbConjugationTable[];
}

export interface NounCaseRow {
  label: string;
  form: string;
}

export interface NounCaseTable {
  title: string;
  rows: NounCaseRow[];
}

export interface NounCaseData {
  tables: NounCaseTable[];
}

export interface VerbConjugationExpansionPayload {
  verbConjugation: VerbConjugationData | null;
}

export interface WordTranslationPayload {
  primary: string;
  alternatives: WordAlternative[];
  grammar: {
    notes: string;
  };
  pronunciation: string;
  verbConjugation: VerbConjugationData | null;
  nounCases: NounCaseData | null;
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
  detailFocus?: 'source' | 'target';
  sourceLanguageHint?: string;
  requestAlternative?: boolean;
  requestVerbConjugationExpansion?: boolean;
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

export interface TranslationHistoryItem {
  id: string;
  createdAt: string;
  sourceText: string;
  result: TranslationResult;
  sentenceAlternatives?: string[];
  provider: ProviderId;
  model: string;
  nativeLanguage: string;
  targetLanguage: string;
  context: TranslationContext;
  directionMode: TranslationDirectionMode;
}
