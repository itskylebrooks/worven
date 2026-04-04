import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { Header } from './components/Header';
import { OutputPanel } from './components/OutputPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { WordDetailsPanel } from './components/WordDetailsPanel';
import { classifyInput } from './lib/classifier';
import { applyTheme, loadSettings, persistSettings, PROVIDER_LABELS } from './lib/settings';
import { translateWithProvider } from './lib/providers';
import type {
  AppSettings,
  SentenceTranslationPayload,
  TranslationRequest,
  TranslationResult,
} from './types';

const panelAccent = 'rounded-[1.75rem] border border-subtle bg-surface-elevated shadow-sm';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [sourceText, setSourceText] = useState('');
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAlternative, setIsLoadingAlternative] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    applyTheme(settings.themeMode);
    persistSettings(settings);
  }, [settings]);

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

    const mode = classifyInput(trimmed);

    try {
      const payload = await runTranslation({
        sourceText: trimmed,
        targetLanguage: settings.targetLanguage,
        nativeLanguage: settings.nativeLanguage,
        context: settings.translationContext,
        mode,
      });

      setResult({
        mode,
        data: payload as TranslationResult['data'],
        sourceText: trimmed,
      } as TranslationResult);
    } catch (translationError) {
      setResult(null);
      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Translation failed for an unknown reason.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAlternative() {
    if (!result || result.mode !== 'sentence' || !result.sourceText.trim()) {
      return;
    }

    setError(null);
    setIsLoadingAlternative(true);

    try {
      const payload = (await runTranslation({
        sourceText: result.sourceText,
        targetLanguage: settings.targetLanguage,
        nativeLanguage: settings.nativeLanguage,
        context: settings.translationContext,
        mode: 'sentence',
        requestAlternative: true,
      })) as SentenceTranslationPayload;

      setResult({
        mode: 'sentence',
        sourceText: result.sourceText,
        data: {
          translation: payload.translation || result.data.translation,
          alternative: payload.alternative,
        },
      });
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Could not load an alternative translation.',
      );
    } finally {
      setIsLoadingAlternative(false);
    }
  }

  function clearInput() {
    setSourceText('');
    setError(null);
    setResult(null);
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

  return (
    <div className="bg-app text-strong">
      <div className="mx-auto max-w-[64rem] px-4 pb-24 sm:pb-6">
        <Header
          providerLabel={PROVIDER_LABELS[settings.provider]}
          modelLabel={settings.model}
          context={settings.translationContext}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="mt-4">
          <section className="grid gap-4 lg:grid-cols-2">
            <section className={`${panelAccent} overflow-hidden`}>
              <div className="border-b border-subtle px-6 py-5 text-center">
                <h1 className="text-base font-semibold uppercase tracking-[0.08em] text-strong">
                  Source
                </h1>
              </div>

              <div className="relative min-h-[20rem] px-6 py-5">
                <textarea
                  id="source-text"
                  className="translator-textarea translator-textarea-size-default"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Type here"
                  spellCheck={false}
                />

                <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
                  <div>
                    {sourceText.trim() ? (
                      <button
                        type="button"
                        onClick={clearInput}
                        className="secondary-button h-10 rounded-full px-4"
                        aria-label="Clear text"
                      >
                        <X className="h-4 w-4" />
                        Clear
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleTranslate()}
                    disabled={isLoading}
                    className="translate-pill"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isLoading ? 'Translating...' : 'Translate'}
                  </button>
                </div>
              </div>
            </section>

            <OutputPanel
              result={result}
              isLoading={isLoading}
              isLoadingAlternative={isLoadingAlternative}
              error={error}
              targetLanguage={settings.targetLanguage}
              onTargetLanguageChange={(targetLanguage) =>
                setSettings((current) => ({ ...current, targetLanguage }))
              }
              onShowAlternative={() => void handleAlternative()}
            />
          </section>

          {result?.mode === 'word' && !isLoading && !error ? (
            <WordDetailsPanel data={result.data} />
          ) : null}
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={setSettings}
      />
    </div>
  );
}
