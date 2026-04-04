import type { TranslationHistoryItem } from '../types';

export const HISTORY_STORAGE_KEY = 'worven-history';
const MAX_HISTORY_ITEMS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    (value.directionMode === 'source_to_target' || value.directionMode === 'target_to_native') &&
    isRecord(value.result) &&
    typeof value.result.mode === 'string' &&
    typeof value.result.sourceText === 'string'
  );
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

    return parsed.filter(isTranslationHistoryItem);
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

export function removeHistoryItem(id: string): TranslationHistoryItem[] {
  const nextHistory = loadHistory().filter((entry) => entry.id !== id);
  persistHistory(nextHistory);
  return nextHistory;
}

export function clearHistory(): TranslationHistoryItem[] {
  persistHistory([]);
  return [];
}
