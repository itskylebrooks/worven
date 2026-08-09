import { useCallback, useState } from 'react';
import {
  addHistoryItem,
  clearHistory,
  loadHistory,
  removeHistoryItem,
  updateHistoryItem,
} from '../lib/history';
import type { TranslationHistoryItem } from '../types';

export function useTranslationHistory() {
  const [items, setItems] = useState<TranslationHistoryItem[]>(() => loadHistory());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const addItem = useCallback((item: TranslationHistoryItem) => {
    setItems(addHistoryItem(item));
  }, []);

  const updateItem = useCallback(
    (id: string, updater: (item: TranslationHistoryItem) => TranslationHistoryItem) => {
      setItems(updateHistoryItem(id, updater));
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems(removeHistoryItem(id));
    setActiveItemId((current) => (current === id ? null : current));
  }, []);

  const clearItems = useCallback(() => {
    setItems(clearHistory());
    setActiveItemId(null);
  }, []);

  return {
    items,
    activeItemId,
    setActiveItemId,
    addItem,
    updateItem,
    removeItem,
    clearItems,
  };
}
