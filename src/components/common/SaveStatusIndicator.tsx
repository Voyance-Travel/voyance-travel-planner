import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'pending' | 'auto-saved';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  layout?: 'inline' | 'stacked';
  autoHide?: boolean;
  autoHideDuration?: number;
  className?: string;
  visible?: boolean;
}

export default function SaveStatusIndicator({
  status,
  message,
  size = 'md',
  layout = 'inline',
  autoHide = false,
  autoHideDuration = 3000,
  className,
  visible = true
}: SaveStatusIndicatorProps) {
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    setIsVisible(visible);
  }, [visible]);

  useEffect(() => {
    if (autoHide && (status === 'saved' || status === 'auto-saved')) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [status, autoHide, autoHideDuration]);

  useEffect(() => {
    if (status !== 'idle') {
      setIsVisible(true);
    }
  }, [status]);

  const getIconAndColors = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="animate-spin" />,
          colors: 'text-blue-600 bg-blue-50 border-blue-200',
        };
      case 'saved':
      case 'auto-saved':
        return {
          icon: <CheckCircle />,
          colors: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        };
      case 'error':
        return {
          icon: <XCircle />,
          colors: 'text-destructive bg-destructive/10 border-destructive/20',
        };
      case 'pending':
        return {
          icon: <Clock />,
          colors: 'text-amber-600 bg-amber-50 border-amber-200',
        };
      default:
        return null;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return { container: 'px-2 py-1 text-xs', icon: 'w-3 h-3', gap: 'gap-1' };
      case 'lg':
        return { container: 'px-4 py-3 text-base', icon: 'w-6 h-6', gap: 'gap-3' };
      default:
        return { container: 'px-3 py-2 text-sm', icon: 'w-4 h-4', gap: 'gap-2' };
    }
  };

  const getDefaultMessage = () => {
    switch (status) {
      case 'saving': return 'Saving...';
      case 'saved': return 'Saved';
      case 'auto-saved': return 'Auto-saved';
      case 'error': return 'Save failed';
      case 'pending': return 'Unsaved changes';
      default: return '';
    }
  };

  const iconAndColors = getIconAndColors();
  const sizeClasses = getSizeClasses();
  const displayMessage = message || getDefaultMessage();

  if (status === 'idle' || !iconAndColors || !isVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'inline-flex items-center rounded-md border font-medium',
          iconAndColors.colors,
          sizeClasses.container,
          layout === 'inline' ? sizeClasses.gap : 'flex-col gap-1',
          className
        )}
      >
        <span className={cn(sizeClasses.icon, 'flex-shrink-0')}>
          {iconAndColors.icon}
        </span>
        {displayMessage && <span>{displayMessage}</span>}
      </motion.div>
    </AnimatePresence>
  );
}

interface FloatingSaveIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'auto-saved';
  message?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  show?: boolean;
}

export function FloatingSaveIndicator({
  status,
  message,
  position = 'top-right',
  show = true
}: FloatingSaveIndicatorProps) {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left': return 'top-4 left-4';
      case 'bottom-right': return 'bottom-4 right-4';
      case 'bottom-left': return 'bottom-4 left-4';
      default: return 'top-4 right-4';
    }
  };

  if (!show || status === 'idle') {
    return null;
  }

  return (
    <div className={cn('fixed z-50', getPositionClasses())}>
      <SaveStatusIndicator
        status={status}
        message={message}
        size="md"
        autoHide={status === 'saved' || status === 'auto-saved'}
        autoHideDuration={3000}
      />
    </div>
  );
}
