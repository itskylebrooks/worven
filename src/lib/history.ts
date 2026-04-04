import type {
  SentenceTranslationPayload,
  TranslationHistoryItem,
  TranslationResult,
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

function isWordTranslationPayload(value: unknown): value is WordTranslationPayload {
  return (
    isRecord(value) &&
    typeof value.primary === 'string' &&
    Array.isArray(value.alternatives) &&
    value.alternatives.every(
      (item) =>
        isRecord(item) && typeof item.term === 'string' && typeof item.gloss === 'string',
    ) &&
    isRecord(value.grammar) &&
    typeof value.grammar.notes === 'string' &&
    typeof value.pronunciation === 'string' &&
    Array.isArray(value.examples) &&
    value.examples.every(
      (item) =>
        isRecord(item) && typeof item.source === 'string' && typeof item.target === 'string',
    )
  );
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
    (typeof value.sentenceAlternatives === 'undefined' || isStringArray(value.sentenceAlternatives)) &&
    (value.directionMode === 'source_to_target' || value.directionMode === 'target_to_native') &&
    isTranslationResult(value.result)
  );
}

function normalizeHistoryItem(item: TranslationHistoryItem): TranslationHistoryItem {
  if (Array.isArray(item.sentenceAlternatives)) {
    return item;
  }

  return {
    ...item,
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
