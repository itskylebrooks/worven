import {
  ChevronDown,
  Download,
  Linkedin,
  Moon,
  Monitor,
  Share2,
  SquareArrowOutUpRight,
  Sun,
  X,
} from 'lucide-react';
import { useState } from 'react';
import pkg from '../../package.json';
import { SUPPORTED_LANGUAGES, TRANSLATION_CONTEXTS } from '../constants/languages';
import { useAnimatedModal } from '../hooks/useAnimatedModal';
import { usePWA, type PWAInstallMode } from '../hooks/usePWA';
import {
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  providerUsesClientKey,
} from '../lib/provider-config';
import { ConfirmModal } from './ConfirmModal';
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

function getInstallModalCopy(mode: PWAInstallMode) {
  switch (mode) {
    case 'ios-share':
      return {
        title: 'Install Worven',
        message: (
          <>
            <p>
              On iPhone or iPad, open Worven in <strong>Safari</strong>, tap{' '}
              <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
            </p>
            <p className="mt-2">
              If you opened Worven in another iOS browser and do not see that option, switch to
              Safari first.
            </p>
          </>
        ),
      };
    case 'safari-mac':
      return {
        title: 'Install Worven',
        message: (
          <p>
            In Safari on macOS, click <strong>Share</strong> and choose{' '}
            <strong>Add to Dock</strong>.
          </p>
        ),
      };
    case 'android-manual':
      return {
        title: 'Install Worven',
        message: (
          <>
            <p>
              Install Worven from your browser menu. On Firefox, Opera, or Samsung Internet, look
              for <strong>Install</strong>, <strong>Add to Home screen</strong>, or a similar menu
              action.
            </p>
            <p className="mt-2">
              In Chrome or Edge on Android, Worven should usually show the browser install prompt
              once the page is recognized as installable.
            </p>
          </>
        ),
      };
    case 'unsupported':
      return {
        title: 'Install Worven',
        message: (
          <>
            <p>
              Install is not available in this browser right now. Try Chrome, Edge, or Safari.
            </p>
            <p className="mt-2">
              Firefox on desktop does not currently support manifest-installed PWAs, and private or
              incognito windows can also block installation.
            </p>
          </>
        ),
      };
    case 'native-prompt':
      return {
        title: 'Install Worven',
        message: (
          <p>
            Worven is ready to install. Use the browser prompt to add it as an app on this device.
          </p>
        ),
      };
  }
}

export function SettingsPanel({ open, settings, onClose, onChange }: SettingsPanelProps) {
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const { visible, closing, entering, beginClose } = useAnimatedModal({
    open,
    onClose,
  });
  const { isInstalled, canInstall, installMode, install, nativePromptAvailable } = usePWA();
  const providerModels = PROVIDER_MODELS[settings.provider];
  const requiresClientApiKey = providerUsesClientKey(settings.provider);
  const installCopy = getInstallModalCopy(installMode);

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

  async function handleInstallClick() {
    if (isInstalled) {
      return;
    }

    if (nativePromptAvailable) {
      await install();
      return;
    }

    setInstallHelpOpen(true);
  }

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-5 transition-colors duration-200 ${
        closing || entering ? 'bg-transparent' : 'bg-overlay backdrop-blur-sm'
      }`}
      onClick={beginClose}
    >
      <div
        className={`relative w-full max-w-sm overflow-y-auto rounded-xl border border-subtle bg-surface-elevated p-6 pt-3 shadow-elevated ring-1 ring-black/5 transition-all duration-200 dark:ring-neutral-700/5 ${
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

          {canInstall && (
            <>
              <section className="text-sm">
                <div className="grid grid-cols-3 items-center gap-2">
                  <div className="col-span-2">
                    <div className="mb-0.5 text-sm font-semibold">INSTALL APP</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleInstallClick()}
                    disabled={isInstalled}
                    aria-disabled={isInstalled}
                    className={`flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
                      isInstalled
                        ? 'cursor-not-allowed border border-subtle text-muted opacity-60'
                        : 'bg-accent text-inverse hover:opacity-90'
                    }`}
                  >
                    <Download className="h-4 w-4" />
                    {isInstalled ? 'Installed' : 'Install'}
                  </button>
                </div>
              </section>

              <div className="border-t border-subtle" />
            </>
          )}

          <section className="space-y-3 text-sm">
            <div className="grid grid-cols-3 items-center gap-2">
              <div>
                <div className="mb-0.5 text-sm font-semibold">PROVIDER</div>
              </div>
              <div className="col-span-2 grid grid-cols-4 gap-2">
                <div className="col-span-3 col-start-2 relative w-full">
                  <select
                    id="provider"
                    aria-label="Provider"
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
                    aria-label="Model"
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
                  {requiresClientApiKey ? (
                    <input
                      id={`${settings.provider}-api-key`}
                      name={`${settings.provider}-api-key`}
                      aria-label="API key"
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
                      onChange={(event) =>
                        handleApiKeyChange(settings.provider, event.target.value)
                      }
                      placeholder={`Paste ${PROVIDER_LABELS[settings.provider]} key`}
                    />
                  ) : (
                    <div className="rounded-lg border border-subtle bg-transparent px-3 py-2 text-sm text-muted">
                      Runs through the Worven server.
                    </div>
                  )}
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
      <ConfirmModal
        open={installHelpOpen}
        onClose={() => setInstallHelpOpen(false)}
        title={installCopy.title}
        message={installCopy.message}
      />
    </div>
  );
}
