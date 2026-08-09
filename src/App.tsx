import { ArrowRightLeft, Eraser, Languages } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatedCopyButton } from './components/AnimatedCopyButton';
import { Header } from './components/Header';
import { HistoryPanel } from './components/HistoryPanel';
import { OutputPanel } from './components/OutputPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { WordDetailsPanel } from './components/WordDetailsPanel';
import { SUPPORTED_LANGUAGES } from './constants/languages';
import { useAppSettings } from './hooks/useAppSettings';
import { useTranslationController } from './hooks/useTranslationController';
import { PROVIDER_LABELS } from './lib/provider-config';
import type { TranslationHistoryItem } from './types';

const panelAccent = 'panel-shell';
const INPUT_TEXTAREA_MIN_HEIGHT_PX = 56;

export default function App() {
  const { settings, updateSettings } = useAppSettings();
  const {
    directionMode,
    sourceText,
    setSourceText,
    result,
    sentenceAlternatives,
    error,
    isLoading,
    isLoadingAlternative,
    isLoadingVerbConjugation,
    historyItems,
    translate: handleTranslate,
    requestAlternative: handleAlternative,
    expandVerbConjugation: handleVerbConjugationExpand,
    clearInput,
    toggleDirectionMode,
    restoreHistoryItem,
    removeHistoryItem,
    clearHistory,
  } = useTranslationController({ settings, updateSettings });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const syncSourceTextareaHeight = useCallback(() => {
    const textarea = sourceTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    const computedStyle = window.getComputedStyle(textarea);
    const maxHeight = Number.parseFloat(computedStyle.maxHeight) || textarea.scrollHeight;
    const nextHeight = Math.max(
      INPUT_TEXTAREA_MIN_HEIGHT_PX,
      Math.min(textarea.scrollHeight, maxHeight),
    );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    syncSourceTextareaHeight();
  }, [sourceText, syncSourceTextareaHeight]);

  useEffect(() => {
    window.addEventListener('resize', syncSourceTextareaHeight);
    return () => window.removeEventListener('resize', syncSourceTextareaHeight);
  }, [syncSourceTextareaHeight]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

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
      }
    } catch {
      return;
    }
  }

  function handleRestoreHistoryItem(item: TranslationHistoryItem) {
    restoreHistoryItem(item);
    setHistoryOpen(false);
  }

  return (
    <div className="bg-app text-strong">
      <div className="mx-auto max-w-[64rem] px-4 pb-24 sm:pb-6">
        <Header
          providerLabel={PROVIDER_LABELS[settings.provider]}
          context={settings.translationContext}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="mt-4">
          <section className="relative grid gap-4 lg:grid-cols-2">
            <section className={`${panelAccent} flex h-full flex-col overflow-hidden`}>
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
                    ref={sourceTextareaRef}
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
                    <Languages className="h-4 w-4" />
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
            <WordDetailsPanel
              data={result.data}
              isLoadingVerbConjugation={isLoadingVerbConjugation}
              onGenerateVerbConjugation={() => void handleVerbConjugationExpand()}
            />
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
        onDelete={removeHistoryItem}
        onClear={clearHistory}
      />
    </div>
  );
}
