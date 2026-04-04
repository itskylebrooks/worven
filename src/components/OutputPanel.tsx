import { AnimatePresence, motion } from 'framer-motion';
import { Languages, Sparkles } from 'lucide-react';
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
  onShowAlternative: () => void;
}

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

export function OutputPanel({
  result,
  isLoading,
  isLoadingAlternative,
  error,
  displayLanguageLabel,
  canChangeLanguage,
  selectedTargetLanguage,
  onTargetLanguageChange,
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

      <div className="min-h-[20rem] overflow-hidden px-6 py-5">
        {isLoading ? (
          <div className="grid min-h-[15rem] place-items-center">
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
          <div className="rounded-2xl bg-subtle p-4 text-sm text-strong">{error}</div>
        ) : (
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={`${result.mode}:${result.sourceText}`}
                {...cardMotion}
                className="flex min-h-[15rem] flex-col overflow-hidden"
              >
                {result.mode === 'word' ? (
                  <div className="flex min-h-[15rem] flex-col overflow-hidden">
                    <div className="translation-scroll-area">
                      <div className="translation-main-text font-medium leading-tight text-strong">
                        {result.data.primary}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[15rem] flex-col overflow-hidden">
                    <div className="translation-scroll-area">
                      <div className="translation-main-text translation-main-text-preserve font-medium leading-tight text-strong">
                        {result.data.translation}
                      </div>
                    </div>

                    <div className="mt-auto pt-5">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          type="button"
                          onClick={onShowAlternative}
                          disabled={isLoadingAlternative}
                          className="secondary-button h-10 rounded-full px-4"
                        >
                          {isLoadingAlternative ? 'Loading...' : 'Show alternative'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="grid min-h-[15rem] place-items-center text-center">
                <div className="max-w-sm space-y-4">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-subtle text-accent">
                    <Languages className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-strong">Ready</p>
                  </div>
                </div>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
