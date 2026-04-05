import { ArrowRight, Trash2, Undo2, X } from 'lucide-react';
import { useAnimatedModal } from '../hooks/useAnimatedModal';
import type { TranslationHistoryItem } from '../types';

interface HistoryPanelProps {
  open: boolean;
  items: TranslationHistoryItem[];
  onClose: () => void;
  onRestore: (item: TranslationHistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

function formatHistoryTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getHistoryTarget(item: TranslationHistoryItem) {
  return item.result.mode === 'word' ? item.result.data.primary : item.result.data.translation;
}

function truncateWords(value: string, wordLimit: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= wordLimit) {
    return value;
  }

  return `${words.slice(0, wordLimit).join(' ')}...`;
}

export function HistoryPanel({
  open,
  items,
  onClose,
  onRestore,
  onDelete,
  onClear,
}: HistoryPanelProps) {
  const { visible, closing, entering, beginClose } = useAnimatedModal({
    open,
    onClose,
  });
  const hasItems = items.length > 0;

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
        className={`relative w-full max-w-2xl overflow-y-auto rounded-xl border border-subtle bg-surface-elevated p-6 pt-3 shadow-elevated ring-1 ring-black/5 transition-all duration-200 dark:ring-neutral-700/5 ${
          closing || entering
            ? 'translate-y-1 scale-[0.95] opacity-0'
            : 'translate-y-0 scale-100 opacity-100'
        }`}
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          maxHeight: 'min(760px, 90vh)',
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <div className="-mx-6 mb-2 border-b border-subtle px-6 pb-3">
          <div className="grid h-12 grid-cols-3 items-center gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={onClear}
                  disabled={!hasItems}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-subtle text-muted transition enabled:hover-nonaccent disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Clear history"
                  title="Clear history"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div />
            </div>

            <span
              id="history-title"
              className="text-center text-lg font-semibold tracking-wide text-strong"
            >
              History
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={beginClose}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-subtle text-muted transition hover-nonaccent"
                  aria-label="Close history"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {hasItems ? (
          <div className="space-y-3 pt-2">
            {items.map((item) => {
              const targetText = getHistoryTarget(item);
              const displaySourceText = truncateWords(item.sourceText, 3);
              const displayTargetText = truncateWords(targetText, 3);

              return (
                <article
                  key={item.id}
                  className="relative rounded-xl border border-subtle bg-surface px-4 py-4 sm:px-5 sm:pr-32"
                >
                  <div className="min-w-0 text-xs uppercase tracking-[0.12em] text-soft">
                    {item.provider} · {item.model} · {item.context}
                  </div>

                  <div className="mt-2.5 min-w-0 pr-0 sm:pr-24">
                    <div className="flex min-w-0 items-start gap-2">
                      <div
                        className="max-w-[45%] shrink-0 whitespace-pre-wrap break-words text-sm leading-6 text-strong"
                      >
                        {displaySourceText}
                      </div>

                      <div className="flex shrink-0 pt-1 text-soft">
                        <ArrowRight className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="break-words text-sm leading-6 text-muted">
                          {displayTargetText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-subtle pt-3 sm:mt-2.5 sm:block sm:border-0 sm:pt-0">
                    <div className="min-w-0 text-xs text-soft">
                      {formatHistoryTimestamp(item.createdAt)}
                    </div>

                    <div className="flex items-center gap-2 sm:absolute sm:right-5 sm:top-1/2 sm:-translate-y-1/2">
                      <button
                        type="button"
                        onClick={() => onRestore(item)}
                        className="icon-button"
                        aria-label="Restore history item"
                        title="Use"
                      >
                        <Undo2 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="icon-button"
                        aria-label="Delete history item"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <div className="text-base font-medium text-strong">No history yet</div>
            <p className="mt-2 text-sm text-muted">Completed translations will show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
