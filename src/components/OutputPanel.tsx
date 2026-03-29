import { AnimatePresence, motion } from 'framer-motion';
import { Languages, Sparkles } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../constants/languages';
import type { TranslationResult } from '../types';

interface OutputPanelProps {
  result: TranslationResult | null;
  isLoading: boolean;
  isLoadingAlternative: boolean;
  error: string | null;
  targetLanguage: string;
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
  targetLanguage,
  onTargetLanguageChange,
  onShowAlternative,
}: OutputPanelProps) {
  return (
    <section className="panel-shell overflow-hidden">
      <div className="border-b border-subtle px-6 py-5 text-center">
        <div className="inline-flex items-center">
          <select
            value={targetLanguage}
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
      </div>

      <div className="min-h-[29rem] px-6 py-5">
        {isLoading ? (
          <div className="grid min-h-[24rem] place-items-center">
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
                className="flex min-h-[24rem] flex-col"
              >
                {result.mode === 'word' ? (
                  <div className="flex min-h-[24rem] flex-col">
                    <div className="text-2xl font-medium leading-tight text-strong sm:text-3xl">
                      {result.data.primary}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2">
                      {result.data.alternatives.map((item) => (
                        <span key={item} className="chip">
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="mt-8 space-y-6">
                      <p className="text-sm leading-6 text-muted">{result.data.grammar.notes}</p>
                      <p className="text-lg leading-7 text-strong">{result.data.pronunciation}</p>
                    </div>

                    <ul className="mt-auto space-y-3 pt-8">
                      {result.data.examples.map((example, index) => (
                        <li key={`${example}-${index}`} className="text-sm leading-6 text-muted">
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex min-h-[24rem] flex-col">
                    <div className="text-2xl font-medium leading-tight text-strong sm:text-3xl">
                      {result.data.translation}
                    </div>

                    <div className="mt-auto border-t border-subtle pt-5">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-muted">Alternative</div>
                        <button
                          type="button"
                          onClick={onShowAlternative}
                          disabled={isLoadingAlternative}
                          className="secondary-button"
                        >
                          {isLoadingAlternative ? 'Loading...' : 'Show alternative'}
                        </button>
                      </div>

                      {result.data.alternative ? (
                        <p className="mt-4 text-sm leading-6 text-muted">
                          {result.data.alternative}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                {...cardMotion}
                className="grid min-h-[24rem] place-items-center text-center"
              >
                <div className="max-w-sm space-y-4">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-subtle text-accent">
                    <Languages className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-strong">Ready</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
