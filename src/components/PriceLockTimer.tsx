import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, AlertTriangle } from 'lucide-react';
import { getPriceLockRemaining } from '@/lib/trips';

interface PriceLockTimerProps {
  expiresAt?: string;
  onExpire?: () => void;
}

export function PriceLockTimer({ expiresAt, onExpire }: PriceLockTimerProps) {
  const [remaining, setRemaining] = useState(() => getPriceLockRemaining(expiresAt));

  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const newRemaining = getPriceLockRemaining(expiresAt);
      setRemaining(newRemaining);
      
      if (newRemaining <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  if (!expiresAt || remaining <= 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <span className="text-destructive">Prices may have changed — refresh options to see current availability</span>
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 120; // Less than 2 minutes

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
        isUrgent 
          ? 'bg-destructive/10 border-destructive/20' 
          : 'bg-accent/10 border-accent/20'
      }`}
    >
      <Timer className={`h-5 w-5 ${isUrgent ? 'text-destructive timer-pulse' : 'text-accent'}`} />
      <div className="flex-1">
        <p className={`text-sm font-medium ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
          Price locked for
        </p>
        <p className="text-xs text-muted-foreground">
          Complete booking to guarantee these rates
        </p>
      </div>
      <div className={`font-mono text-2xl font-bold ${isUrgent ? 'text-destructive' : 'text-accent'}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
    </motion.div>
  );
}
