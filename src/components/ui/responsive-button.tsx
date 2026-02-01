/**
 * ResponsiveButton - Button with loading/success state feedback
 * Shows visual progression: idle → loading → success → idle
 */

import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ButtonState = 'idle' | 'loading' | 'success' | 'error';

interface ResponsiveButtonProps extends Omit<ButtonProps, 'onClick'> {
  children: ReactNode;
  /** Async click handler - button will show loading state during execution */
  onClick?: () => Promise<void> | void;
  /** Text to show while loading */
  loadingText?: string;
  /** Text to show on success */
  successText?: string;
  /** How long to show success state (ms) */
  successDuration?: number;
  /** Controlled state (optional - for external state management) */
  state?: ButtonState;
  /** Called when state changes */
  onStateChange?: (state: ButtonState) => void;
}

export function ResponsiveButton({
  children,
  onClick,
  loadingText = 'Working...',
  successText = 'Done!',
  successDuration = 1500,
  state: controlledState,
  onStateChange,
  className,
  disabled,
  variant,
  size,
  ...props
}: ResponsiveButtonProps) {
  const [internalState, setInternalState] = useState<ButtonState>('idle');
  
  // Use controlled state if provided, otherwise internal
  const state = controlledState ?? internalState;
  const setState = (newState: ButtonState) => {
    if (controlledState === undefined) {
      setInternalState(newState);
    }
    onStateChange?.(newState);
  };

  const handleClick = async () => {
    if (state !== 'idle' || !onClick) return;

    setState('loading');

    try {
      await onClick();
      setState('success');
      
      // Return to idle after success duration
      setTimeout(() => {
        setState('idle');
      }, successDuration);
    } catch (error) {
      setState('error');
      // Return to idle quickly on error
      setTimeout(() => {
        setState('idle');
      }, 500);
    }
  };

  const isDisabled = disabled || state !== 'idle';

  // Determine variant based on state
  const getVariant = () => {
    if (state === 'success') return 'default'; // Keep default for success state
    return variant;
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      variant={getVariant()}
      size={size}
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        state === 'success' && 'bg-accent hover:bg-accent',
        state === 'loading' && 'cursor-wait',
        className
      )}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'idle' && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}

        {state === 'loading' && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            {loadingText}
          </motion.span>
        )}

        {state === 'success' && (
          <motion.span
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            {successText}
          </motion.span>
        )}

        {state === 'error' && (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
