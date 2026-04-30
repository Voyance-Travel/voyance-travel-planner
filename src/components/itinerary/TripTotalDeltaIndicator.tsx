/**
 * TripTotalDeltaIndicator
 *
 * Shows a small, dismissable indicator when the trip total changes between
 * fetches. Prevents the "price drifted silently" surprise where AI repair,
 * day regeneration, or hotel sync writes new activity_costs rows.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import type { FinancialDelta } from '@/hooks/useTripFinancialSnapshot';

interface TripTotalDeltaIndicatorProps {
  delta: FinancialDelta | null;
  onDismiss: () => void;
  className?: string;
}

function formatUsd(cents: number): string {
  const abs = Math.abs(cents) / 100;
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
  return `$${abs.toFixed(0)}`;
}

export function TripTotalDeltaIndicator({
  delta,
  onDismiss,
  className,
}: TripTotalDeltaIndicatorProps) {
  return (
    <AnimatePresence>
      {delta && delta.deltaCents !== 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
            delta.deltaCents > 0
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
          } ${className ?? ''}`}
          role="status"
          aria-live="polite"
        >
          {delta.deltaCents > 0 ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          <span className="font-medium">
            {delta.deltaCents > 0 ? '+' : '−'}
            {formatUsd(delta.deltaCents)}
          </span>
          <span className="text-muted-foreground">just now</span>
          <button
            onClick={onDismiss}
            className="ml-1 -mr-1 p-0.5 rounded hover:bg-foreground/5 transition-colors"
            aria-label="Dismiss change indicator"
          >
            <X className="h-3 w-3" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TripTotalDeltaIndicator;
