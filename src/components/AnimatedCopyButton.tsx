import { Check, Copy } from 'lucide-react';

interface AnimatedCopyButtonProps {
  copied: boolean;
  onClick: () => void;
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  className?: string;
}

export function AnimatedCopyButton({
  copied,
  onClick,
  ariaLabel,
  title,
  disabled = false,
  className = 'icon-button',
}: AnimatedCopyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
    >
      <span className="grid place-items-center">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </span>
    </button>
  );
}
