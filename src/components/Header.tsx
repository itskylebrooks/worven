import { History, Settings2 } from 'lucide-react';
import type { TranslationContext } from '../types';

interface HeaderProps {
  providerLabel: string;
  context: TranslationContext;
  targetLanguage: string;
  onOpenSettings: () => void;
}

export function Header({ providerLabel, context, targetLanguage, onOpenSettings }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-app">
      <div className="relative flex items-center justify-between py-2.5 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="inline-flex h-10 items-center text-2xl font-bold uppercase tracking-wider text-strong transition-colors hover-change-color">
              Worven
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 hidden -translate-x-1/2 text-sm text-muted md:inline-flex md:items-center">
          {providerLabel} · {targetLanguage} · {context}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            title="History arrives in Phase 3"
            className="icon-button cursor-not-allowed opacity-60"
            aria-label="History coming in Phase 3"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="icon-button"
            aria-label="Open settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
