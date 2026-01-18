import { motion } from 'framer-motion';
import { Lock, AlertCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PriceLockTimerProps {
  /**
   * Initial time in seconds. Default is 15 minutes (900 seconds).
   * Amadeus flight offers are typically valid for 15-30 minutes.
   * Set to match your backend's actual price hold duration.
   */
  initialTime?: number;
  expiresAt?: number | string;
  onExpire?: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

// Amadeus API typically holds prices for 15-30 minutes
const DEFAULT_PRICE_LOCK_SECONDS = 15 * 60; // 15 minutes

export default function PriceLockTimer({
  initialTime = DEFAULT_PRICE_LOCK_SECONDS,
  expiresAt,
  onExpire,
  className,
  variant = 'default'
}: PriceLockTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (expiresAt) {
      const expiryTime = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt;
      const now = Date.now();
      const remainingTime = Math.floor((expiryTime - now) / 1000);
      if (remainingTime > 0) {
        setTimeRemaining(remainingTime);
      } else {
        setTimeRemaining(0);
        setIsExpired(true);
        onExpire?.();
      }
      return;
    }

    const savedExpiryTime = localStorage.getItem('priceHoldExpires');
    if (savedExpiryTime) {
      const expiryTimestamp = parseInt(savedExpiryTime);
      const now = Date.now();
      const remainingTime = Math.floor((expiryTimestamp - now) / 1000);
      if (remainingTime > 0) {
        setTimeRemaining(remainingTime);
      } else {
        setTimeRemaining(0);
        setIsExpired(true);
        onExpire?.();
      }
    } else {
      const expiryTime = Date.now() + initialTime * 1000;
      localStorage.setItem('priceHoldExpires', expiryTime.toString());
    }
  }, [initialTime, expiresAt, onExpire]);

  useEffect(() => {
    if (isExpired || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          onExpire?.();
          localStorage.removeItem('priceHoldExpires');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isExpired, onExpire, timeRemaining]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getColorScheme = () => {
    if (isExpired) return 'text-destructive bg-destructive/10 border-destructive/20';
    if (timeRemaining <= 120) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (timeRemaining <= 300) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  };

  if (isExpired) {
    return (
      <motion.div
        className={cn('flex items-center gap-3 p-4 rounded-lg border', getColorScheme(), className)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium">Price Lock Expired</p>
          <p className="text-sm opacity-80">Prices may have changed. Please refresh to see current rates.</p>
        </div>
      </motion.div>
    );
  }

  // Compact variant for sidebars
  if (variant === 'compact') {
    return (
      <motion.div
        className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm', getColorScheme(), className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className="font-medium">{formatTime(timeRemaining)}</span>
        <span className="opacity-80">price hold</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn('flex items-center gap-3 p-4 rounded-lg border', getColorScheme(), className)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Lock className="w-5 h-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-medium">Prices Locked</p>
        <p className="text-sm opacity-80">
          Your current prices are guaranteed for the next {formatTime(timeRemaining)}
        </p>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold font-mono">
          {formatTime(timeRemaining)}
        </div>
        <div className="text-xs opacity-80">remaining</div>
      </div>
    </motion.div>
  );
}

// Named export for backwards compatibility
export { PriceLockTimer };
