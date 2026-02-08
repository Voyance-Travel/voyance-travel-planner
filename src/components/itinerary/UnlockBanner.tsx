/**
 * UnlockBanner — Sticky CTA shown on preview itineraries
 * 
 * Offers two unlock paths:
 * 1. Unlock ALL days at once (bulk discount feel)
 * 2. Per-day unlock (handled by parent via onUnlockDay)
 * 
 * Shows credit cost, progress during unlock, and handles the full flow.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUnlockTrip, type UnlockTripParams } from '@/hooks/useUnlockTrip';
import { CreditNudge } from './CreditNudge';
import { formatCredits, CREDIT_COSTS } from '@/config/pricing';

interface UnlockBannerProps {
  tripId: string;
  totalDays: number;
  destination: string;
  destinationCountry?: string;
  travelers: number;
  startDate: string;
  budgetTier?: string;
  tripType?: string;
  onUnlockComplete?: (enrichedItinerary: any) => void;
}

export function UnlockBanner({
  tripId,
  totalDays,
  destination,
  destinationCountry,
  travelers,
  startDate,
  budgetTier,
  tripType,
  onUnlockComplete,
}: UnlockBannerProps) {
  const { state, unlock, isUnlocking, getUnlockCost, canAfford, totalCredits } = useUnlockTrip();
  const [showNudge, setShowNudge] = useState(false);

  const unlockCost = getUnlockCost(totalDays);
  const affordable = canAfford(totalDays);
  const perDayCost = CREDIT_COSTS.UNLOCK_DAY;

  const handleUnlockAll = async () => {
    if (!affordable) {
      setShowNudge(true);
      return;
    }

    const params: UnlockTripParams = {
      tripId,
      totalDays,
      destination,
      destinationCountry,
      travelers,
      startDate,
      budgetTier,
      tripType,
    };

    await unlock(params, onUnlockComplete);
  };

  // During unlock — show progress
  if (isUnlocking) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/20 bg-primary/5 p-4"
      >
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div>
            <p className="font-medium text-sm text-foreground">{state.message}</p>
            <p className="text-xs text-muted-foreground">
              Day {state.currentDay} of {state.totalDays}
            </p>
          </div>
        </div>
        <Progress value={state.progress} className="h-2" />
      </motion.div>
    );
  }

  // After unlock complete — show nothing
  if (state.step === 'complete') {
    return null;
  }

  // Error state
  if (state.step === 'error' && state.error !== 'insufficient_credits') {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive font-medium">
          Something went wrong during unlock. Your credits were not charged.
        </p>
        <Button size="sm" variant="outline" className="mt-2" onClick={handleUnlockAll}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-4"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground">
                Preview Mode — Details Locked
              </p>
              <p className="text-xs text-muted-foreground">
                Unlock days to see addresses, photos, tips & booking links
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Unlock all days */}
            <Button onClick={handleUnlockAll} className="gap-2 flex-1">
              <Sparkles className="h-4 w-4" />
              Unlock All {totalDays} Days · {formatCredits(unlockCost)} credits
            </Button>
            
            {/* Per-day hint */}
            <p className="text-xs text-muted-foreground text-center sm:text-left self-center">
              or unlock individual days for {formatCredits(perDayCost)} credits each
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {(showNudge || state.error === 'insufficient_credits') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CreditNudge
              action="UNLOCK_DAY"
              currentBalance={totalCredits}
              onDismiss={() => setShowNudge(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
