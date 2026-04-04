import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';

interface AnimatedCopyButtonProps {
  copied: boolean;
  onClick: () => void;
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  className?: string;
}

const iconMotion = {
  initial: { opacity: 0, scale: 0.82 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, scale: 0.82, transition: { duration: 0.16 } },
};

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
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? 'check' : 'copy'}
          {...iconMotion}
          className="grid place-items-center"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
