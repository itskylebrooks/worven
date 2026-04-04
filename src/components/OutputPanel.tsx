import { Languages, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { AnimatedCopyButton } from './AnimatedCopyButton';
import { SUPPORTED_LANGUAGES } from '../constants/languages';
import type { TranslationResult } from '../types';

interface OutputPanelProps {
  result: TranslationResult | null;
  isLoading: boolean;
  isLoadingAlternative: boolean;
  error: string | null;
  displayLanguageLabel: string;
  canChangeLanguage: boolean;
  selectedTargetLanguage: string;
  onTargetLanguageChange: (language: string) => void;
  isTranslationCopied: boolean;
  onCopyTranslation: () => void;
  onShowAlternative: () => void;
}

export function OutputPanel({
  result,
  isLoading,
  isLoadingAlternative,
  error,
  displayLanguageLabel,
  canChangeLanguage,
  selectedTargetLanguage,
  onTargetLanguageChange,
  isTranslationCopied,
  onCopyTranslation,
  onShowAlternative,
}: OutputPanelProps) {
  return (
    <section className="panel-shell overflow-hidden">
      <div className="border-b border-subtle px-6 py-5 text-center">
        {canChangeLanguage ? (
          <div className="target-language-select-shell">
            <span className="target-language-select-label" aria-hidden="true">
              {displayLanguageLabel}
            </span>
            <select
              value={selectedTargetLanguage}
              onChange={(event) => onTargetLanguageChange(event.target.value)}
              className="target-language-select"
              aria-label="Target language"
            >
              {SUPPORTED_LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="target-language-select-label">{displayLanguageLabel}</div>
        )}
      </div>

      <div className="panel-body overflow-hidden">
        {isLoading ? (
          <div className="panel-content grid place-items-center">
            <div className="space-y-4 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-subtle text-accent">
                <Sparkles className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <p className="text-base font-medium text-strong">Translating</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="panel-content grid place-items-center">
            <div className="max-w-sm text-center">
              <p className="whitespace-pre-wrap text-base font-medium text-strong">{error}</p>
            </div>
          </div>
        ) : !result ? (
          <div className="panel-content">
            <div className="grid h-full place-items-center text-center">
              <div className="max-w-sm space-y-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-subtle text-accent">
                  <Languages className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-lg font-medium text-strong">Ready</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="panel-content">
              <div className="flex h-full min-h-0 flex-col overflow-hidden">
                {result.mode === 'word' ? (
                  <div className="translation-scroll-area">
                    <div className="translation-main-text font-medium leading-tight text-strong">
                      {result.data.primary}
                    </div>
                  </div>
                ) : (
                  <div className="translation-scroll-area">
                    <div className="translation-main-text translation-main-text-preserve font-medium leading-tight text-strong">
                      {result.data.translation}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {result.mode === 'word' ? (
              <div className="panel-actions justify-start">
                <div className="flex items-center justify-start gap-4">
                  <AnimatedCopyButton
                    copied={isTranslationCopied}
                    onClick={onCopyTranslation}
                    ariaLabel="Copy translation"
                    title={isTranslationCopied ? 'Copied' : 'Copy'}
                  />
                </div>
              </div>
            ) : (
              <div className="panel-actions">
                <AnimatedCopyButton
                  copied={isTranslationCopied}
                  onClick={onCopyTranslation}
                  ariaLabel="Copy translation"
                  title={isTranslationCopied ? 'Copied' : 'Copy'}
                />
                <button
                  type="button"
                  onClick={onShowAlternative}
                  disabled={isLoadingAlternative}
                  className="icon-button"
                  aria-label={isLoadingAlternative ? 'Loading alternative' : 'Show alternative'}
                  title={isLoadingAlternative ? 'Loading alternative' : 'Show alternative'}
                >
                  {isLoadingAlternative ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
