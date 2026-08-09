import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyInput } from '../lib/classifier';
import { translateWithProvider } from '../lib/providers';
import { buildTranslationRequest } from '../lib/translation-request';
import type {
  AppSettings,
  TranslationDirectionMode,
  TranslationHistoryItem,
  TranslationRequest,
  TranslationResult,
  VerbConjugationExpansionPayload,
} from '../types';
import { useTranslationHistory } from './useTranslationHistory';

type TranslationOperation = 'translation' | 'alternative' | 'verb-conjugation';

interface UseTranslationControllerOptions {
  settings: AppSettings;
  updateSettings: (next: React.SetStateAction<AppSettings>) => void;
}

function createHistoryItemId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveSentenceAlternatives(
  result: TranslationResult,
  fallbackAlternatives?: string[],
) {
  if (fallbackAlternatives && fallbackAlternatives.length > 0) {
    return fallbackAlternatives;
  }

  return result.mode === 'sentence' && result.data.alternative
    ? [result.data.alternative]
    : [];
}

export function useTranslationController({
  settings,
  updateSettings,
}: UseTranslationControllerOptions) {
  const [directionMode, setDirectionMode] =
    useState<TranslationDirectionMode>('source_to_target');
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [sentenceAlternatives, setSentenceAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeOperation, setActiveOperation] = useState<TranslationOperation | null>(null);
  const requestVersionRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const history = useTranslationHistory();

  const cancelPendingRequest = useCallback(() => {
    requestVersionRef.current += 1;
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
  }, []);

  useEffect(() => cancelPendingRequest, [cancelPendingRequest]);

  function beginRequest(operation: TranslationOperation) {
    cancelPendingRequest();
    const controller = new AbortController();
    const version = requestVersionRef.current;
    requestAbortRef.current = controller;
    setActiveOperation(operation);
    setError(null);
    return { controller, version };
  }

  function isCurrentRequest(version: number, controller: AbortController) {
    return !controller.signal.aborted && requestVersionRef.current === version;
  }

  function finishRequest(version: number, controller: AbortController) {
    if (!isCurrentRequest(version, controller)) {
      return;
    }

    requestAbortRef.current = null;
    setActiveOperation(null);
  }

  async function runTranslation(
    request: TranslationRequest & { mode: 'word'; requestVerbConjugationExpansion: true },
    signal: AbortSignal,
  ): Promise<VerbConjugationExpansionPayload>;
  async function runTranslation(
    request: TranslationRequest & { mode: 'word' },
    signal: AbortSignal,
  ): Promise<Extract<TranslationResult, { mode: 'word' }>['data']>;
  async function runTranslation(
    request: TranslationRequest & { mode: 'sentence' },
    signal: AbortSignal,
  ): Promise<Extract<TranslationResult, { mode: 'sentence' }>['data']>;
  async function runTranslation(request: TranslationRequest, signal: AbortSignal) {
    return translateWithProvider(
      settings.provider,
      settings.apiKeys[settings.provider],
      settings.model,
      request,
      signal,
    );
  }

  async function translate() {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      cancelPendingRequest();
      setActiveOperation(null);
      setError('Enter a word or sentence to translate.');
      setResult(null);
      return;
    }

    setSentenceAlternatives([]);
    history.setActiveItemId(null);

    const mode = classifyInput(trimmed);
    const { controller, version } = beginRequest('translation');

    try {
      const nextResult: TranslationResult =
        mode === 'word'
          ? {
              mode,
              data: await runTranslation(
                buildTranslationRequest(settings, directionMode, {
                  sourceText: trimmed,
                  mode,
                }),
                controller.signal,
              ),
              sourceText: trimmed,
            }
          : {
              mode,
              data: await runTranslation(
                buildTranslationRequest(settings, directionMode, {
                  sourceText: trimmed,
                  mode,
                }),
                controller.signal,
              ),
              sourceText: trimmed,
            };

      if (!isCurrentRequest(version, controller)) {
        return;
      }

      const nextHistoryItemId = createHistoryItemId();
      const initialSentenceAlternatives = resolveSentenceAlternatives(nextResult);
      setResult(nextResult);
      setSentenceAlternatives(initialSentenceAlternatives);
      history.setActiveItemId(nextHistoryItemId);
      history.addItem({
        id: nextHistoryItemId,
        createdAt: new Date().toISOString(),
        sourceText: trimmed,
        result: nextResult,
        sentenceAlternatives: initialSentenceAlternatives,
        provider: settings.provider,
        model: settings.model,
        nativeLanguage: settings.nativeLanguage,
        targetLanguage: settings.targetLanguage,
        context: settings.translationContext,
        directionMode,
      });
    } catch (translationError) {
      if (!isCurrentRequest(version, controller)) {
        return;
      }

      setResult(null);
      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Translation failed for an unknown reason.',
      );
    } finally {
      finishRequest(version, controller);
    }
  }

  async function requestAlternative() {
    if (!result || result.mode !== 'sentence' || !result.sourceText.trim()) {
      return;
    }

    const currentResult = result;
    const { controller, version } = beginRequest('alternative');

    try {
      const payload = await runTranslation(
        buildTranslationRequest(settings, directionMode, {
          sourceText: currentResult.sourceText,
          mode: 'sentence',
          requestAlternative: true,
        }),
        controller.signal,
      );

      if (!isCurrentRequest(version, controller)) {
        return;
      }

      setResult({
        mode: 'sentence',
        sourceText: currentResult.sourceText,
        data: {
          translation: payload.translation || currentResult.data.translation,
          alternative: currentResult.data.alternative,
        },
      });

      const nextAlternative = payload.alternative?.trim();
      if (nextAlternative) {
        setSentenceAlternatives((current) => {
          const nextAlternatives = [...current, nextAlternative];

          if (history.activeItemId) {
            history.updateItem(history.activeItemId, (entry) => ({
              ...entry,
              sentenceAlternatives: nextAlternatives,
            }));
          }

          return nextAlternatives;
        });
      }
    } catch (translationError) {
      if (!isCurrentRequest(version, controller)) {
        return;
      }

      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Could not load an alternative translation.',
      );
    } finally {
      finishRequest(version, controller);
    }
  }

  async function expandVerbConjugation() {
    if (
      !result ||
      result.mode !== 'word' ||
      !result.data.verbConjugation ||
      result.data.verbConjugation.coverage === 'full'
    ) {
      return;
    }

    const currentResult = result;
    const { controller, version } = beginRequest('verb-conjugation');

    try {
      const payload = await runTranslation(
        buildTranslationRequest(settings, directionMode, {
          sourceText: currentResult.sourceText,
          mode: 'word',
          requestVerbConjugationExpansion: true,
        }),
        controller.signal,
      );

      if (!isCurrentRequest(version, controller)) {
        return;
      }

      setResult((current) => {
        if (!current || current.mode !== 'word') {
          return current;
        }

        return {
          ...current,
          data: {
            ...current.data,
            verbConjugation: payload.verbConjugation,
          },
        };
      });

      if (history.activeItemId) {
        history.updateItem(history.activeItemId, (entry) => {
          if (entry.result.mode !== 'word') {
            return entry;
          }

          return {
            ...entry,
            result: {
              ...entry.result,
              data: {
                ...entry.result.data,
                verbConjugation: payload.verbConjugation,
              },
            },
          };
        });
      }
    } catch (translationError) {
      if (!isCurrentRequest(version, controller)) {
        return;
      }

      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Could not load full verb conjugation tables.',
      );
    } finally {
      finishRequest(version, controller);
    }
  }

  function resetTranslationOutput(clearSourceText = false) {
    setActiveOperation(null);
    setError(null);
    setSentenceAlternatives([]);
    history.setActiveItemId(null);
    setResult(null);

    if (clearSourceText) {
      setSourceText('');
    }
  }

  function clearInput() {
    cancelPendingRequest();
    resetTranslationOutput(true);
  }

  function toggleDirectionMode() {
    cancelPendingRequest();
    setDirectionMode((current) =>
      current === 'source_to_target' ? 'target_to_native' : 'source_to_target',
    );
    resetTranslationOutput();
  }

  function restoreHistoryItem(item: TranslationHistoryItem) {
    cancelPendingRequest();
    updateSettings((current) => ({
      ...current,
      provider: item.provider,
      model: item.model,
      nativeLanguage: item.nativeLanguage,
      targetLanguage: item.targetLanguage,
      translationContext: item.context,
    }));
    setDirectionMode(item.directionMode);
    setActiveOperation(null);
    setError(null);
    setSourceText(item.sourceText);
    setResult(item.result);
    setSentenceAlternatives(resolveSentenceAlternatives(item.result, item.sentenceAlternatives));
    history.setActiveItemId(item.id);
  }

  return {
    directionMode,
    sourceText,
    setSourceText,
    result,
    sentenceAlternatives,
    error,
    isLoading: activeOperation === 'translation',
    isLoadingAlternative: activeOperation === 'alternative',
    isLoadingVerbConjugation: activeOperation === 'verb-conjugation',
    historyItems: history.items,
    translate,
    requestAlternative,
    expandVerbConjugation,
    clearInput,
    toggleDirectionMode,
    restoreHistoryItem,
    removeHistoryItem: history.removeItem,
    clearHistory: history.clearItems,
  };
}
