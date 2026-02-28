/**
 * FirstUseHint — a one-time inline callout banner.
 * Auto-dismisses after `autoDismissMs` (default 8s) or on "Got it" click.
 */

import { useEffect } from 'react';
import { useFirstUseHint } from '@/hooks/useFirstUseHint';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface FirstUseHintProps {
  hintKey: string;
  message: string;
  autoDismissMs?: number;
  className?: string;
}

export function FirstUseHint({
  hintKey,
  message,
  autoDismissMs = 8000,
  className,
}: FirstUseHintProps) {
  const { shouldShow, dismiss } = useFirstUseHint(hintKey);

  useEffect(() => {
    if (!shouldShow || autoDismissMs <= 0) return;
    const timer = setTimeout(dismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [shouldShow, autoDismissMs, dismiss]);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn(
            'flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-foreground',
            className,
          )}
        >
          <span className="flex-1">{message}</span>
          <button
            onClick={dismiss}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            Got it
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
