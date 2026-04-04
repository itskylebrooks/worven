import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Linkedin,
  Moon,
  Monitor,
  Share2,
  SquareArrowOutUpRight,
  Sun,
  X,
} from 'lucide-react';
import pkg from '../../package.json';
import { SUPPORTED_LANGUAGES, TRANSLATION_CONTEXTS } from '../constants/languages';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '../lib/settings';
import type { AppSettings, ProviderId } from '../types';

interface SettingsPanelProps {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onChange: (settings: AppSettings) => void;
}

interface ThemeButtonProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function updateSettings(
  settings: AppSettings,
  onChange: (next: AppSettings) => void,
  patch: Partial<AppSettings>,
) {
  onChange({ ...settings, ...patch });
}

function ThemeButton({ active, label, icon, onClick }: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid h-10 w-full place-items-center rounded-lg border border-subtle transition ${
        active
          ? 'bg-accent text-inverse shadow-elevated'
          : 'bg-surface-elevated text-muted hover-nonaccent'
      }`}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      <span className="sr-only">{label}</span>
      {icon}
    </button>
  );
}

export function SettingsPanel({ open, settings, onClose, onChange }: SettingsPanelProps) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const [entering, setEntering] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const enterRaf = useRef<number | null>(null);
  const providerModels = PROVIDER_MODELS[settings.provider];

  useEffect(() => {
    if (open) {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (enterRaf.current) cancelAnimationFrame(enterRaf.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      setClosing(false);
      setEntering(true);
      enterRaf.current = requestAnimationFrame(() => {
        enterRaf.current = requestAnimationFrame(() => setEntering(false));
      });
    } else if (visible) {
      setClosing(true);
      timeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 220);
    }
  }, [open, visible]);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (enterRaf.current) cancelAnimationFrame(enterRaf.current);
    },
    [],
  );

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  const beginClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      onClose();
      setVisible(false);
      setClosing(false);
    }, 220);
  }, [closing, onClose]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        beginClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, beginClose]);

  async function handleShare() {
    try {
      const shareData: ShareData = {
        title: 'Worven',
        text: 'Check out Worven',
        url: window.location.href,
      };
      const navWithShare = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
      };
      if (typeof navWithShare.share === 'function') {
        await navWithShare.share(shareData);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        return;
      }
      window.prompt('Copy this link', window.location.href);
    } catch {
      return;
    }
  }

  function handleProviderChange(provider: ProviderId) {
    updateSettings(settings, onChange, {
      provider,
      model: PROVIDER_MODELS[provider][0],
    });
  }

  function handleApiKeyChange(provider: ProviderId, nextValue: string) {
    onChange({
      ...settings,
      apiKeys: {
        ...settings.apiKeys,
        [provider]: nextValue,
      },
    });
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-5 transition-colors duration-200 ${
        closing || entering ? 'bg-transparent' : 'bg-overlay backdrop-blur-sm'
      }`}
      onClick={beginClose}
    >
      <div
        className={`relative w-full max-w-sm overflow-y-auto rounded-2xl border border-subtle bg-surface-elevated p-6 pt-3 shadow-elevated ring-1 ring-black/5 transition-all duration-200 dark:ring-neutral-700/5 ${
          closing || entering
            ? 'translate-y-1 scale-[0.95] opacity-0'
            : 'translate-y-0 scale-100 opacity-100'
        }`}
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          maxHeight: 'min(720px, 90vh)',
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="-mx-6 mb-2 border-b border-subtle px-6 pb-3">
          <div className="grid h-12 grid-cols-3 items-center gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="grid h-10 w-full place-items-center rounded-lg border border-subtle text-muted transition hover-nonaccent"
                aria-label="Share"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </button>
              <div />
            </div>

            <span
              id="settings-title"
              className="text-center text-lg font-semibold tracking-wide text-strong"
            >
              Settings
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div />
              <button
                type="button"
                onClick={beginClose}
                className="grid h-10 w-full place-items-center rounded-lg border border-subtle text-muted transition hover-nonaccent"
                aria-label="Close settings"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <section className="text-sm">
            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">THEME</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2 whitespace-nowrap">
                <div />
                <ThemeButton
                  active={settings.themeMode === 'system'}
                  label="System theme"
                  icon={<Monitor className="h-5 w-5" />}
                  onClick={() => updateSettings(settings, onChange, { themeMode: 'system' })}
                />
                <ThemeButton
                  active={settings.themeMode === 'light'}
                  label="Light theme"
                  icon={<Sun className="h-5 w-5" />}
                  onClick={() => updateSettings(settings, onChange, { themeMode: 'light' })}
                />
                <ThemeButton
                  active={settings.themeMode === 'dark'}
                  label="Dark theme"
                  icon={<Moon className="h-5 w-5" />}
                  onClick={() => updateSettings(settings, onChange, { themeMode: 'dark' })}
                />
              </div>
            </div>
          </section>

          <div className="border-t border-subtle" />

          <section className="space-y-3 text-sm">
            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">PROVIDER</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-3 col-start-2 relative w-full">
                  <select
                    id="provider"
                    value={settings.provider}
                    onChange={(event) => handleProviderChange(event.target.value as ProviderId)}
                    className="appearance-none h-10 w-full rounded-lg border border-subtle bg-transparent px-3 pr-7 text-sm text-strong"
                  >
                    {Object.entries(PROVIDER_LABELS).map(([provider, label]) => (
                      <option key={provider} value={provider}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">MODEL</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-3 col-start-2 relative w-full">
                  <select
                    id="model"
                    value={settings.model}
                    onChange={(event) =>
                      updateSettings(settings, onChange, { model: event.target.value })
                    }
                    className="appearance-none h-10 w-full rounded-lg border border-subtle bg-transparent px-3 pr-7 text-sm text-strong"
                  >
                    {providerModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">API KEY</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-3 col-start-2">
                  <input
                    id={`${settings.provider}-api-key`}
                    name={`${settings.provider}-api-key`}
                    type="password"
                    className="h-10 w-full rounded-lg border border-subtle bg-transparent px-3 text-sm text-strong outline-none transition"
                    autoComplete="new-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    spellCheck={false}
                    value={settings.apiKeys[settings.provider]}
                    onChange={(event) => handleApiKeyChange(settings.provider, event.target.value)}
                    placeholder={`Paste ${PROVIDER_LABELS[settings.provider]} key`}
                  />
                  <p className="mt-2 text-[11px] text-muted">
                    Saved encrypted on this device.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="border-t border-subtle" />

          <section className="space-y-3 text-sm">
            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">LANGUAGE</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-3 col-start-2 relative w-full">
                  <select
                    id="native-language"
                    className="appearance-none h-10 w-full rounded-lg border border-subtle bg-transparent px-3 pr-7 text-sm text-strong"
                    value={settings.nativeLanguage}
                    onChange={(event) =>
                      updateSettings(settings, onChange, { nativeLanguage: event.target.value })
                    }
                  >
                    {SUPPORTED_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">TONE</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-3 col-start-2 relative w-full">
                  <select
                    id="context"
                    value={settings.translationContext}
                    onChange={(event) =>
                      updateSettings(settings, onChange, {
                        translationContext: event.target.value as AppSettings['translationContext'],
                      })
                    }
                    className="appearance-none h-10 w-full rounded-lg border border-subtle bg-transparent px-3 pr-7 text-sm text-strong"
                  >
                    {TRANSLATION_CONTEXTS.map((context) => (
                      <option key={context} value={context}>
                        {context}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>
          </section>

          <div className="-mx-6 mt-6 border-t border-subtle px-6 pt-4">
            <div className="text-[12px] text-muted">
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid h-10 w-full place-items-center">
                    <a
                      href="https://www.linkedin.com/in/itskylebrooks/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Kyle Brooks on LinkedIn"
                      className="inline-flex items-center justify-center text-strong opacity-90 transition-opacity hover:opacity-75"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                  </div>
                  <div />
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="whitespace-nowrap font-medium text-strong">
                    Kyle Brooks <span className="mx-2">•</span> Worven {pkg.version}
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-3 whitespace-nowrap">
                    <a
                      href="https://kylebrooks.me/imprint"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 inline-block leading-tight underline"
                    >
                      Imprint
                    </a>
                    <a
                      href="https://kylebrooks.me/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 inline-block leading-tight underline"
                    >
                      Privacy Policy
                    </a>
                    <a
                      href="https://kylebrooks.me/license"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 inline-block leading-tight underline"
                    >
                      License
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div />
                  <div className="grid h-10 w-full place-items-center">
                    <a
                      href="https://kylebrooks.me/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Kyle Brooks website"
                      className="inline-flex items-center justify-center text-strong opacity-90 transition-opacity hover:opacity-75"
                    >
                      <SquareArrowOutUpRight className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
