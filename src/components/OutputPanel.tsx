import { AnimatePresence, motion } from 'framer-motion';
import { Languages, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

const dropdownMotion = {
  initial: { opacity: 0, y: 6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.14 } },
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
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const languageButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        languageMenuRef.current?.contains(target) ||
        languageButtonRef.current?.contains(target)
      ) {
        return;
      }
      setLanguageMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLanguageMenuOpen(false);
        languageButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [languageMenuOpen]);

  return (
    <section className="panel-shell overflow-hidden">
      <div className="border-b border-subtle px-6 py-5 text-center">
        <div className="relative inline-flex items-center">
          <button
            ref={languageButtonRef}
            type="button"
            className="target-language-trigger"
            onClick={() => setLanguageMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={languageMenuOpen}
          >
            <span>{targetLanguage}</span>
          </button>

          <AnimatePresence>
            {languageMenuOpen ? (
              <div className="language-menu-anchor">
                <motion.div
                  ref={languageMenuRef}
                  className="language-menu"
                  role="listbox"
                  aria-label="Target language"
                  {...dropdownMotion}
                >
                  <div className="language-menu-scroll">
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <button
                        key={language}
                        type="button"
                        className={`language-menu-item ${language === targetLanguage ? 'language-menu-item-active' : ''}`}
                        onClick={() => {
                          onTargetLanguageChange(language);
                          setLanguageMenuOpen(false);
                        }}
                      >
                        {language}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : null}
          </AnimatePresence>
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
