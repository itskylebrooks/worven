import type {
  NounCaseData,
  NounCaseTable,
  TranslationHistoryItem,
  TranslationResult,
  VerbConjugationCoverage,
  VerbConjugationData,
  VerbConjugationTable,
  WordTranslationPayload,
} from '../types';
import {
  isSentenceTranslationPayload,
  isSupportedLanguage,
  isTranslationContext,
} from './translation-contract';
import { PROVIDER_MODELS, isAllowedModel, isProviderId } from './provider-config';

export const HISTORY_STORAGE_KEY = 'worven-history';
export const HISTORY_STORAGE_VERSION = 1;
const MAX_HISTORY_ITEMS = 40;

interface PersistedHistoryEnvelope {
  version: typeof HISTORY_STORAGE_VERSION;
  items: TranslationHistoryItem[];
}

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
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.sourceText === 'string' &&
    isProviderId(value.provider) &&
    typeof value.model === 'string' &&
    isSupportedLanguage(value.nativeLanguage) &&
    isSupportedLanguage(value.targetLanguage) &&
    isTranslationContext(value.context) &&
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

  return {
    ...item,
    model: isAllowedModel(item.provider, item.model)
      ? item.model
      : PROVIDER_MODELS[item.provider][0],
    result: normalizedResult,
    sentenceAlternatives: Array.isArray(item.sentenceAlternatives)
      ? item.sentenceAlternatives
      : item.result.mode === 'sentence' && item.result.data.alternative
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
    const persistedItems = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) &&
          parsed.version === HISTORY_STORAGE_VERSION &&
          Array.isArray(parsed.items)
        ? parsed.items
        : null;

    if (!persistedItems) {
      return [];
    }

    return persistedItems
      .filter(isTranslationHistoryItem)
      .map((item) => normalizeHistoryItem(item))
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function persistHistory(history: TranslationHistoryItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const envelope: PersistedHistoryEnvelope = {
    version: HISTORY_STORAGE_VERSION,
    items: history.slice(0, MAX_HISTORY_ITEMS),
  };
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(envelope));
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
