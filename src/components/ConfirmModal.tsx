import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAnimatedModal } from '../hooks/useAnimatedModal';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Close',
}: ConfirmModalProps) {
  const { visible, closing, entering, beginClose } = useAnimatedModal({
    open,
    onClose,
  });

  if (!visible) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] flex flex-col items-center p-5 transition-colors duration-200 ${
        closing || entering ? 'bg-transparent' : 'bg-overlay backdrop-blur-sm'
      }`}
      onClick={beginClose}
    >
      <div className="pointer-events-none flex-[4] min-h-[40px]" />
      <div
        className={`relative w-full max-w-sm rounded-xl border border-subtle bg-surface-elevated p-5 ring-1 ring-black/5 transition-all duration-200 dark:ring-neutral-700/5 ${
          closing || entering
            ? 'translate-y-1 scale-[0.95] opacity-0'
            : 'translate-y-0 scale-100 opacity-100'
        }`}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <h2 id="confirm-modal-title" className="text-base font-semibold text-strong">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{message}</div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-subtle px-3 py-2 text-sm font-medium bg-surface text-strong hover-nonaccent"
            onClick={beginClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-inverse hover:opacity-90"
            onClick={beginClose}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      <div className="pointer-events-none flex-[6]" />
    </div>,
    document.body,
  );
}
