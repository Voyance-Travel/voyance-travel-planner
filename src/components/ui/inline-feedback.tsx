/**
 * InlineFeedback - Small feedback right where action happened
 * Shows contextual acknowledgment with animation
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedbackType = 'success' | 'info' | 'warning';

interface InlineFeedbackProps {
  /** Whether to show the feedback */
  show: boolean;
  /** The message to display */
  message: string;
  /** Type determines color and icon */
  type?: FeedbackType;
  /** Auto-dismiss after this many ms (0 = never) */
  duration?: number;
  /** Called when feedback auto-dismisses */
  onDismiss?: () => void;
  /** Position relative to trigger element */
  position?: 'inline' | 'below' | 'above';
  /** Additional className */
  className?: string;
}

const typeConfig = {
  success: {
    icon: Check,
    colors: 'text-accent',
    bg: 'bg-accent/10',
  },
  info: {
    icon: Info,
    colors: 'text-primary',
    bg: 'bg-primary/10',
  },
  warning: {
    icon: AlertTriangle,
    colors: 'text-gold',
    bg: 'bg-gold/10',
  },
};

export function InlineFeedback({
  show,
  message,
  type = 'success',
  duration = 1500,
  onDismiss,
  position = 'inline',
  className,
}: InlineFeedbackProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);

    if (show && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onDismiss]);

  const config = typeConfig[type];
  const Icon = config.icon;

  const positionClasses = {
    inline: 'inline-flex ml-2',
    below: 'flex mt-2',
    above: 'flex mb-2',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9, y: position === 'below' ? -4 : position === 'above' ? 4 : 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: position === 'below' ? 4 : position === 'above' ? -4 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            'items-center gap-1 text-sm font-medium',
            positionClasses[position],
            config.colors,
            className
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{message}</span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// Hook for managing inline feedback state
export function useInlineFeedback(defaultDuration = 1500) {
  const [feedbackState, setFeedbackState] = useState<{
    show: boolean;
    message: string;
    type: FeedbackType;
  }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showFeedback = (message: string, type: FeedbackType = 'success') => {
    setFeedbackState({ show: true, message, type });
  };

  const hideFeedback = () => {
    setFeedbackState(prev => ({ ...prev, show: false }));
  };

  return {
    feedbackProps: {
      ...feedbackState,
      duration: defaultDuration,
      onDismiss: hideFeedback,
    },
    showFeedback,
    hideFeedback,
  };
}
