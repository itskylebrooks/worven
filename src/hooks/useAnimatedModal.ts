import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAnimatedModalOptions {
  open: boolean;
  onClose: () => void;
  closeDurationMs?: number;
}

export function useAnimatedModal({
  open,
  onClose,
  closeDurationMs = 220,
}: UseAnimatedModalOptions) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const [entering, setEntering] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const enterRafRef = useRef<number | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const clearEnterAnimation = useCallback(() => {
    if (enterRafRef.current) {
      cancelAnimationFrame(enterRafRef.current);
      enterRafRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearCloseTimeout();
      clearEnterAnimation();
    },
    [clearCloseTimeout, clearEnterAnimation],
  );

  useEffect(() => {
    if (open) {
      clearCloseTimeout();
      clearEnterAnimation();
      // Keep the modal mounted immediately when the controlled open state flips on.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      setClosing(false);
      setEntering(true);

      enterRafRef.current = requestAnimationFrame(() => {
        enterRafRef.current = requestAnimationFrame(() => {
          setEntering(false);
          enterRafRef.current = null;
        });
      });

      return;
    }

    if (!visible) {
      return;
    }

    setClosing(true);
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
      closeTimeoutRef.current = null;
    }, closeDurationMs);
  }, [clearCloseTimeout, clearEnterAnimation, closeDurationMs, open, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  const beginClose = useCallback(() => {
    if (closing) {
      return;
    }

    clearCloseTimeout();
    setClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
      setVisible(false);
      setClosing(false);
      closeTimeoutRef.current = null;
    }, closeDurationMs);
  }, [clearCloseTimeout, closeDurationMs, closing, onClose]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        beginClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [beginClose, visible]);

  return { visible, closing, entering, beginClose };
}
