import type { TranslationMode } from '../types';

const sentenceSignals = /[.!?;:()[\]\n]/;

export function classifyInput(sourceText: string): TranslationMode {
  const trimmed = sourceText.trim();
  const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (sentenceSignals.test(trimmed)) {
    return 'sentence';
  }

  if (tokenCount <= 2 && !trimmed.includes(',')) {
    return 'word';
  }

  return 'sentence';
}
