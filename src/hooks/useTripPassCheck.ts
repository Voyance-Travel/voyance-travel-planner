/**
 * Trip Pass Check Hook
 * 
 * Checks if a specific trip has been unlocked via Trip Pass purchase.
 * Used to gate regeneration features.
 */

import { useMemo } from 'react';
import { useEntitlements } from './useEntitlements';

interface TripPassResult {
  /** Whether this specific trip is unlocked */
  isUnlocked: boolean;
  /** Whether user has any paid subscription (monthly/yearly) */
  hasSubscription: boolean;
  /** Whether user can regenerate this trip's itinerary */
  canRegenerate: boolean;
  /** Whether user can rebuild individual days */
  canRebuildDay: boolean;
  /** User-friendly reason if action is blocked */
  blockReason: string | null;
  /** Whether data is still loading */
  isLoading: boolean;
}

export function useTripPassCheck(tripId: string | null | undefined): TripPassResult {
  const { data, isLoading, isPaid } = useEntitlements();

  return useMemo(() => {
    if (isLoading || !data) {
      return {
        isUnlocked: false,
        hasSubscription: false,
        canRegenerate: false,
        canRebuildDay: false,
        blockReason: null,
        isLoading: true,
      };
    }

    // Check if user has paid subscription
    const hasSubscription = isPaid;

    // Check if this specific trip is in the unlocked trips list
    const unlockedTrips: string[] = data.unlocked_trips || [];
    const isUnlocked = tripId ? unlockedTrips.includes(tripId) : false;

    // Can regenerate if: has subscription OR this trip is unlocked
    const canRegenerate = hasSubscription || isUnlocked;
    const canRebuildDay = hasSubscription || isUnlocked;

    // Build block reason
    let blockReason: string | null = null;
    if (!canRegenerate) {
      if (data.can_build_itinerary) {
        // User can still build (has free build or credits), just not rebuild
        blockReason = 'Unlock this trip with a Trip Pass to enable unlimited rebuilds, or upgrade to Monthly.';
      } else {
        blockReason = 'Purchase a Trip Pass for $12.99 to unlock rebuilds for this trip, or subscribe monthly.';
      }
    }

    return {
      isUnlocked,
      hasSubscription,
      canRegenerate,
      canRebuildDay,
      blockReason,
      isLoading: false,
    };
  }, [data, isLoading, isPaid, tripId]);
}

export default useTripPassCheck;
