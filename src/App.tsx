import { ArrowRightLeft, Eraser, Languages, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AnimatedCopyButton } from './components/AnimatedCopyButton';
import { Header } from './components/Header';
import { HistoryPanel } from './components/HistoryPanel';
import { OutputPanel } from './components/OutputPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { WordDetailsPanel } from './components/WordDetailsPanel';
import { SUPPORTED_LANGUAGES } from './constants/languages';
import { classifyInput } from './lib/classifier';
import {
  addHistoryItem,
  clearHistory,
  loadHistory,
  removeHistoryItem,
  updateHistoryItem,
} from './lib/history';
import { translateWithProvider } from './lib/providers';
import {
  applyTheme,
  loadSettings,
  loadSettingsSnapshot,
  persistSettings,
  PROVIDER_LABELS,
} from './lib/settings';
import type {
  AppSettings,
  TranslationDirectionMode,
  TranslationHistoryItem,
  TranslationRequest,
  TranslationResult,
} from './types';

const panelAccent = 'panel-shell';
export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettingsSnapshot());
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [directionMode, setDirectionMode] = useState<TranslationDirectionMode>('source_to_target');
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [sentenceAlternatives, setSentenceAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAlternative, setIsLoadingAlternative] = useState(false);
  const [historyItems, setHistoryItems] = useState<TranslationHistoryItem[]>(() => loadHistory());
  const [activeHistoryItemId, setActiveHistoryItemId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const hasLocalSettingsChanges = useRef(false);
  const requestVersionRef = useRef(0);

  function createHistoryItemId() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function resolveSentenceAlternatives(
    nextResult: TranslationResult,
    fallbackAlternatives?: string[],
  ) {
    if (fallbackAlternatives && fallbackAlternatives.length > 0) {
      return fallbackAlternatives;
    }

    return nextResult.mode === 'sentence' && nextResult.data.alternative
      ? [nextResult.data.alternative]
      : [];
  }

  function cancelPendingRequest() {
    requestVersionRef.current += 1;
  }

  function clearTranslationSelection() {
    setSentenceAlternatives([]);
    setActiveHistoryItemId(null);
  }

  function resetRequestState() {
    setIsLoading(false);
    setIsLoadingAlternative(false);
    setError(null);
  }

  function resetTranslationOutput(options?: { clearSourceText?: boolean }) {
    resetRequestState();
    clearTranslationSelection();
    setResult(null);

    if (options?.clearSourceText) {
      setSourceText('');
    }
  }

  function updateSettings(next: React.SetStateAction<AppSettings>) {
    hasLocalSettingsChanges.current = true;
    setSettings(next);
  }

  useEffect(() => {
    applyTheme(settings.themeMode);
  }, [settings.themeMode]);

  useEffect(() => {
    let active = true;

    void loadSettings().then((loadedSettings) => {
      if (!active) {
        return;
      }

      if (!hasLocalSettingsChanges.current) {
        setSettings(loadedSettings);
      }

      setSettingsHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }

    void persistSettings(settings);
  }, [settings, settingsHydrated]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (settings.themeMode !== 'system' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [settings.themeMode]);

  async function runTranslation(
    request: TranslationRequest & { mode: 'word' },
  ): Promise<Extract<TranslationResult, { mode: 'word' }>['data']>;
  async function runTranslation(
    request: TranslationRequest & { mode: 'sentence' },
  ): Promise<Extract<TranslationResult, { mode: 'sentence' }>['data']>;
  async function runTranslation(request: TranslationRequest) {
    return translateWithProvider(
      settings.provider,
      settings.apiKeys[settings.provider],
      settings.model,
      request,
    );
  }

  async function handleTranslate() {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setError('Enter a word or sentence to translate.');
      setResult(null);
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsLoadingAlternative(false);
    clearTranslationSelection();

    const mode = classifyInput(trimmed);
    const requestVersion = ++requestVersionRef.current;
    const requestBase = {
      sourceText: trimmed,
      targetLanguage:
        directionMode === 'source_to_target' ? settings.targetLanguage : settings.nativeLanguage,
      nativeLanguage: settings.nativeLanguage,
      context: settings.translationContext,
      detailFocus: directionMode === 'source_to_target' ? 'target' : 'source',
      sourceLanguageHint:
        directionMode === 'source_to_target' ? settings.nativeLanguage : settings.targetLanguage,
    } as const;

    try {
      const nextResult: TranslationResult =
        mode === 'word'
          ? {
              mode,
              data: await runTranslation({ ...requestBase, mode }),
              sourceText: trimmed,
            }
          : {
              mode,
              data: await runTranslation({ ...requestBase, mode }),
              sourceText: trimmed,
            };
      const nextHistoryItemId = createHistoryItemId();
      const initialSentenceAlternatives = resolveSentenceAlternatives(nextResult);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setResult(nextResult);
      setSentenceAlternatives(initialSentenceAlternatives);
      setActiveHistoryItemId(nextHistoryItemId);
      setHistoryItems(
        addHistoryItem({
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
        }),
      );
    } catch (translationError) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setResult(null);
      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Translation failed for an unknown reason.',
      );
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function handleAlternative() {
    if (!result || result.mode !== 'sentence' || !result.sourceText.trim()) {
      return;
    }

    setError(null);
    setIsLoadingAlternative(true);
    const requestVersion = ++requestVersionRef.current;

    try {
      const payload = await runTranslation({
        sourceText: result.sourceText,
        targetLanguage: settings.targetLanguage,
        nativeLanguage: settings.nativeLanguage,
        context: settings.translationContext,
        mode: 'sentence',
        requestAlternative: true,
      });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setResult({
        mode: 'sentence',
        sourceText: result.sourceText,
        data: {
          translation: payload.translation || result.data.translation,
          alternative: result.data.alternative,
        },
      });
      const nextAlternative = payload.alternative?.trim();
      if (nextAlternative) {
        setSentenceAlternatives((current) => {
          const nextAlternatives = [...current, nextAlternative];

          if (activeHistoryItemId) {
            setHistoryItems(
              updateHistoryItem(activeHistoryItemId, (entry) => ({
                ...entry,
                sentenceAlternatives: nextAlternatives,
              })),
            );
          }

          return nextAlternatives;
        });
      }
    } catch (translationError) {
      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Could not load an alternative translation.',
      );
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoadingAlternative(false);
      }
    }
  }

  function clearInput() {
    cancelPendingRequest();
    resetTranslationOutput({ clearSourceText: true });
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleTranslate();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      clearInput();
    }
  }

  function toggleDirectionMode() {
    cancelPendingRequest();
    setDirectionMode((current) =>
      current === 'source_to_target' ? 'target_to_native' : 'source_to_target',
    );
    resetTranslationOutput();
  }

  const leftPanelLabel = directionMode === 'source_to_target' ? 'Source' : settings.targetLanguage;
  const rightPanelLabel = directionMode === 'source_to_target' ? settings.targetLanguage : 'Source';
  const showSentenceAlternativePanel =
    result?.mode === 'sentence' && sentenceAlternatives.length > 0;

  function flashCopied(key: string) {
    setCopiedKey(key);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
      copyTimeoutRef.current = null;
    }, 1200);
  }

  async function copyText(value: string, key: string) {
    const text = value.trim();
    if (!text) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        flashCopied(key);
        return;
      }
    } catch {
      return;
    }
  }

  function handleRestoreHistoryItem(item: TranslationHistoryItem) {
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
    resetRequestState();
    setSourceText(item.sourceText);
    setResult(item.result);
    setSentenceAlternatives(resolveSentenceAlternatives(item.result, item.sentenceAlternatives));
    setActiveHistoryItemId(item.id);
    setHistoryOpen(false);
  }

  return (
    <div className="bg-app text-strong">
      <div className="mx-auto max-w-[64rem] px-4 pb-24 sm:pb-6">
        <Header
          providerLabel={PROVIDER_LABELS[settings.provider]}
          modelLabel={settings.model}
          context={settings.translationContext}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="mt-4">
          <section className="relative grid gap-4 lg:grid-cols-2">
            <section className={`${panelAccent} overflow-hidden`}>
              <div className="border-b border-subtle px-6 py-5 text-center">
                {directionMode === 'target_to_native' ? (
                  <div className="target-language-select-shell">
                    <span className="target-language-select-label" aria-hidden="true">
                      {leftPanelLabel}
                    </span>
                    <select
                      value={settings.targetLanguage}
                      onChange={(event) =>
                        updateSettings((current) => ({
                          ...current,
                          targetLanguage: event.target.value,
                        }))
                      }
                      className="target-language-select"
                      aria-label="Foreign language"
                    >
                      {SUPPORTED_LANGUAGES.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <h1 className="text-base font-semibold uppercase tracking-[0.08em] text-strong">
                    {leftPanelLabel}
                  </h1>
                )}
              </div>

              <div className="panel-body">
                <div className="panel-content">
                  <textarea
                    id="source-text"
                    className="translator-textarea translator-textarea-size-default"
                    value={sourceText}
                    onChange={(event) => setSourceText(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Type here"
                    spellCheck={false}
                  />
                </div>

                <div className="panel-actions">
                  <div>
                    {sourceText.trim() ? (
                      <button
                        type="button"
                        onClick={clearInput}
                        className="icon-button"
                        aria-label="Clear text"
                        title="Clear"
                      >
                        <Eraser className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleTranslate()}
                    disabled={isLoading}
                    className="icon-button"
                    aria-label={isLoading ? 'Translating' : 'Translate'}
                    title={isLoading ? 'Translating' : 'Translate'}
                  >
                    {isLoading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Languages className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={toggleDirectionMode}
              className="absolute left-1/2 top-2 z-10 hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-subtle bg-surface-elevated text-muted shadow-sm transition hover-nonaccent lg:inline-flex"
              aria-label="Switch translation direction"
              title="Switch translation direction"
            >
              <ArrowRightLeft className="h-5 w-5" />
            </button>

            <OutputPanel
              result={result}
              isLoading={isLoading}
              isLoadingAlternative={isLoadingAlternative}
              error={error}
              displayLanguageLabel={rightPanelLabel}
              canChangeLanguage={directionMode === 'source_to_target'}
              selectedTargetLanguage={settings.targetLanguage}
              onTargetLanguageChange={(targetLanguage) =>
                updateSettings((current) => ({ ...current, targetLanguage }))
              }
              isTranslationCopied={copiedKey === 'output-translation'}
              onCopyTranslation={() => {
                if (!result) return;
                void copyText(
                  result.mode === 'word' ? result.data.primary : result.data.translation,
                  'output-translation',
                );
              }}
              onShowAlternative={() => void handleAlternative()}
            />
          </section>

          {showSentenceAlternativePanel ? (
            <div className="mt-4 space-y-4">
              {sentenceAlternatives.map((alternative, index) => (
                <section key={`${alternative}-${index}`} className={`${panelAccent} px-6 py-5`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="word-section-label">Alternative</div>
                    <AnimatedCopyButton
                      copied={copiedKey === `alternative-${index}`}
                      onClick={() => void copyText(alternative, `alternative-${index}`)}
                      ariaLabel={`Copy alternative ${index + 1}`}
                      title={copiedKey === `alternative-${index}` ? 'Copied' : 'Copy'}
                    />
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-muted">
                    {alternative}
                  </p>
                </section>
              ))}
            </div>
          ) : null}

          {result?.mode === 'word' && !isLoading && !error ? (
            <WordDetailsPanel data={result.data} />
          ) : null}
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
      />

      <HistoryPanel
        open={historyOpen}
        items={historyItems}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistoryItem}
        onDelete={(id) => setHistoryItems(removeHistoryItem(id))}
        onClear={() => setHistoryItems(clearHistory())}
      />
    </div>
  );
}
