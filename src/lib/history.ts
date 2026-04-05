import type {
  NounCaseData,
  NounCaseTable,
  SentenceTranslationPayload,
  TranslationHistoryItem,
  TranslationResult,
  VerbConjugationCoverage,
  VerbConjugationData,
  VerbConjugationTable,
  WordTranslationPayload,
} from '../types';

export const HISTORY_STORAGE_KEY = 'worven-history';
const MAX_HISTORY_ITEMS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWordAlternative(value: unknown): value is WordTranslationPayload['alternatives'][number] {
  return isRecord(value) && typeof value.term === 'string' && typeof value.gloss === 'string';
}

function isVerbConjugationTable(value: unknown): value is VerbConjugationTable {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    Array.isArray(value.rows) &&
    value.rows.every(
      (row) => isRecord(row) && typeof row.label === 'string' && typeof row.form === 'string',
    )
  );
}

function isVerbConjugationCoverage(value: unknown): value is VerbConjugationCoverage {
  return value === 'basic' || value === 'full';
}

function isNounCaseTable(value: unknown): value is NounCaseTable {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    Array.isArray(value.rows) &&
    value.rows.every(
      (row) => isRecord(row) && typeof row.label === 'string' && typeof row.form === 'string',
    )
  );
}

function isVerbConjugationData(value: unknown): value is VerbConjugationData {
  return (
    isRecord(value) &&
    isVerbConjugationCoverage(value.coverage) &&
    Array.isArray(value.present) &&
    value.present.every(isVerbConjugationTable) &&
    Array.isArray(value.past) &&
    value.past.every(isVerbConjugationTable) &&
    Array.isArray(value.future) &&
    value.future.every(isVerbConjugationTable)
  );
}

function isNounCaseData(value: unknown): value is NounCaseData {
  return isRecord(value) && Array.isArray(value.tables) && value.tables.every(isNounCaseTable);
}

function isWordTranslationPayload(value: unknown): value is WordTranslationPayload {
  const legacyGrammar = isRecord(value) && isRecord(value.grammar) ? value.grammar : null;
  const hasEtymology =
    isRecord(value) &&
    (typeof value.etymology === 'string' ||
      (legacyGrammar !== null && typeof legacyGrammar.notes === 'string'));

  return (
    isRecord(value) &&
    typeof value.primary === 'string' &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every(isWordAlternative) &&
    (typeof value.antonyms === 'undefined' ||
      (Array.isArray(value.antonyms) && value.antonyms.every(isWordAlternative))) &&
    hasEtymology &&
    typeof value.pronunciation === 'string' &&
    (typeof value.verbConjugation === 'undefined' ||
      value.verbConjugation === null ||
      isVerbConjugationData(value.verbConjugation) ||
      isVerbConjugationTable(value.verbConjugation)) &&
    (typeof value.nounCases === 'undefined' ||
      value.nounCases === null ||
      isNounCaseData(value.nounCases)) &&
    Array.isArray(value.examples) &&
    value.examples.every(
      (item) =>
        isRecord(item) && typeof item.source === 'string' && typeof item.target === 'string',
    )
  );
}

function normalizeWordTranslationPayload(item: WordTranslationPayload): WordTranslationPayload {
  const verbConjugation = normalizeVerbConjugationData(item.verbConjugation);
  const nounCases = normalizeNounCaseData(item.nounCases);
  const legacyGrammar =
    'grammar' in item && typeof item.grammar === 'object' && item.grammar !== null ? item.grammar : null;
  const etymology =
    typeof item.etymology === 'string'
      ? item.etymology
      : typeof (legacyGrammar as { notes?: unknown } | null)?.notes === 'string'
        ? ((legacyGrammar as { notes: string }).notes ?? '')
        : '';

  return {
    ...item,
    antonyms: Array.isArray(item.antonyms) ? item.antonyms : [],
    etymology,
    verbConjugation,
    nounCases,
  };
}

function normalizeVerbConjugationData(value: unknown): VerbConjugationData | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  if (isVerbConjugationTable(value)) {
    return {
      coverage: 'basic',
      present: [value],
      past: [],
      future: [],
    };
  }

  if (!isVerbConjugationData(value)) {
    return null;
  }

  if (value.coverage === 'basic') {
    return value.present.length > 0
      ? {
          coverage: 'basic',
          present: value.present.slice(0, 1),
          past: [],
          future: [],
        }
      : null;
  }

  if (value.present.length === 0 && value.past.length === 0 && value.future.length === 0) {
    return null;
  }

  return value;
}

function normalizeNounCaseData(value: unknown): NounCaseData | null {
  if (value === null || typeof value === 'undefined' || !isNounCaseData(value)) {
    return null;
  }

  return value.tables.length > 0 ? value : null;
}

function isSentenceTranslationPayload(value: unknown): value is SentenceTranslationPayload {
  return (
    isRecord(value) &&
    typeof value.translation === 'string' &&
    (typeof value.alternative === 'string' || value.alternative === null)
  );
}

function isTranslationResult(value: unknown): value is TranslationResult {
  if (!isRecord(value) || typeof value.sourceText !== 'string') {
    return false;
  }

  if (value.mode === 'word') {
    return isWordTranslationPayload(value.data);
  }

  if (value.mode === 'sentence') {
    return isSentenceTranslationPayload(value.data);
  }

  return false;
}

function isTranslationHistoryItem(value: unknown): value is TranslationHistoryItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.sourceText === 'string' &&
    typeof value.provider === 'string' &&
    typeof value.model === 'string' &&
    typeof value.nativeLanguage === 'string' &&
    typeof value.targetLanguage === 'string' &&
    typeof value.context === 'string' &&
    (typeof value.sentenceAlternatives === 'undefined' ||
      isStringArray(value.sentenceAlternatives)) &&
    (value.directionMode === 'source_to_target' || value.directionMode === 'target_to_native') &&
    isTranslationResult(value.result)
  );
}

function normalizeHistoryItem(item: TranslationHistoryItem): TranslationHistoryItem {
  const normalizedResult =
    item.result.mode === 'word'
      ? {
          ...item.result,
          data: normalizeWordTranslationPayload(item.result.data),
        }
      : item.result;

  if (Array.isArray(item.sentenceAlternatives)) {
    return {
      ...item,
      result: normalizedResult,
    };
  }

  return {
    ...item,
    result: normalizedResult,
    sentenceAlternatives:
      item.result.mode === 'sentence' && item.result.data.alternative
        ? [item.result.data.alternative]
        : [],
  };
}

export function loadHistory(): TranslationHistoryItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTranslationHistoryItem).map((item) => normalizeHistoryItem(item));
  } catch {
    return [];
  }
}

function persistHistory(history: TranslationHistoryItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export function addHistoryItem(item: TranslationHistoryItem): TranslationHistoryItem[] {
  const nextHistory = [item, ...loadHistory().filter((entry) => entry.id !== item.id)].slice(
    0,
    MAX_HISTORY_ITEMS,
  );
  persistHistory(nextHistory);
  return nextHistory;
}

export function updateHistoryItem(
  id: string,
  updater: (item: TranslationHistoryItem) => TranslationHistoryItem,
): TranslationHistoryItem[] {
  const nextHistory = loadHistory().map((entry) => (entry.id === id ? updater(entry) : entry));
  persistHistory(nextHistory);
  return nextHistory;
}

export function removeHistoryItem(id: string): TranslationHistoryItem[] {
  const nextHistory = loadHistory().filter((entry) => entry.id !== id);
  persistHistory(nextHistory);
  return nextHistory;
}

export function clearHistory(): TranslationHistoryItem[] {
  persistHistory([]);
  return [];
}
