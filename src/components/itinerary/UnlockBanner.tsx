/**
 * UnlockBanner — Sticky CTA shown on preview itineraries
 * 
 * Shows credit cost, progress during unlock, and handles the full flow.
 * Displays inline CreditNudge when user can't afford it.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUnlockTrip, type UnlockTripParams } from '@/hooks/useUnlockTrip';
import { CreditNudge } from './CreditNudge';
import { formatCredits } from '@/config/pricing';

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

  const handleUnlock = async () => {
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

  // After unlock complete — show nothing (parent will re-render with full itinerary)
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
        <Button size="sm" variant="outline" className="mt-2" onClick={handleUnlock}>
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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">
                Preview Mode — Details Locked
              </p>
              <p className="text-xs text-muted-foreground">
                Unlock addresses, photos, tips & booking links for all {totalDays} days
              </p>
            </div>
          </div>
          <Button onClick={handleUnlock} className="gap-2 shrink-0">
            <Sparkles className="h-4 w-4" />
            Unlock · {formatCredits(unlockCost)} credits
          </Button>
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
