/**
 * UnlockBanner — Sticky CTA shown on preview itineraries
 * 
 * Offers two unlock paths:
 * 1. Unlock ALL days at once (bulk discount feel)
 * 2. Per-day unlock (handled by parent via onUnlockDay)
 * 
 * Shows credit cost, progress during unlock, and handles the full flow.
 */

import { motion } from 'framer-motion';
import { Lock, Sparkles, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useManualBuilderStore } from '@/stores/manual-builder-store';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { useUnlockTrip, type UnlockTripParams } from '@/hooks/useUnlockTrip';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';
import { CREDIT_COSTS } from '@/config/pricing';

interface UnlockBannerProps {
  tripId: string;
  totalDays: number;
  /** Number of days that are already unlocked/free (e.g., 2 for first-trip gift) */
  freeDays?: number;
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
  freeDays = 0,
  destination,
  destinationCountry,
  travelers,
  startDate,
  budgetTier,
  tripType,
  onUnlockComplete,
}: UnlockBannerProps) {
  const { state, unlock, isUnlocking, getUnlockCost, canAfford, totalCredits } = useUnlockTrip();
  const { enableManualBuilder } = useManualBuilderStore();
  const { showOutOfCredits } = useOutOfCredits();

  // Only charge for days that aren't already free
  const daysToUnlock = Math.max(0, totalDays - freeDays);
  const unlockCost = getUnlockCost(daysToUnlock);
  const affordable = totalCredits >= unlockCost;

  const handleManualBuild = () => {
    enableManualBuilder(tripId);
    toast.success('Manual builder mode enabled! Edit freely.');
  };

  const handleUnlockAll = async () => {
    if (!affordable) {
      showOutOfCredits({
        action: 'UNLOCK_DAY',
        creditsNeeded: unlockCost,
        creditsAvailable: totalCredits,
        tripId,
      });
      return;
    }

    const params: UnlockTripParams = {
      tripId,
      totalDays: daysToUnlock, // Only unlock the remaining locked days
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
                Preview Mode: Details Locked
              </p>
              <p className="text-xs text-muted-foreground">
                Unlock days to see addresses, photos, tips & booking links
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button onClick={handleUnlockAll} className="gap-2 flex-1">
              <Sparkles className="h-4 w-4" />
              {daysToUnlock < totalDays 
                ? `Unlock Remaining ${daysToUnlock} Days` 
                : `Unlock All ${totalDays} Days`}
            </Button>
            <Button variant="outline" onClick={handleManualBuild} className="gap-2 flex-1">
              <Pencil className="h-4 w-4" />
              I'll build it myself
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
