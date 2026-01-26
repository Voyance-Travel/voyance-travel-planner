import { useMemo } from 'react';
import { useEntitlements } from './useEntitlements';
import { FREE_TIER_LIMITS } from '@/config/pricing';

export interface FreeTierLimits {
  // Day visibility
  maxVisibleDays: number;
  canViewDay: (dayNumber: number) => boolean;
  
  // Activity swaps
  maxActivitySwaps: number;
  swapsRemaining: number;
  canSwapActivity: boolean;
  
  // Day regeneration
  canRegenerateDay: boolean;
  
  // Export/Share
  canExport: boolean;
  canShare: boolean;
  
  // Overall status
  isFreeUser: boolean;
  isUnlocked: boolean; // Has Trip Pass or credits
}

/**
 * Hook to check free tier limits for the current user.
 * Free users can only see Day 1 and swap 3 activities.
 */
export function useFreeTierLimits(tripId?: string): FreeTierLimits {
  const { data, isPaid } = useEntitlements();

  return useMemo(() => {
    // If user has paid (Trip Pass, credits, or subscription), they're unlocked
    const isUnlocked = isPaid || (data?.is_paid ?? false);
    const isFreeUser = !isUnlocked;

    // Check if this specific trip is unlocked via Trip Pass
    const unlockedTrips: string[] = data?.unlocked_trips || [];
    const tripUnlocked = tripId ? unlockedTrips.includes(tripId) : false;
    
    // User has full access if they're paid OR this trip is unlocked
    const hasFullAccess = isUnlocked || tripUnlocked;

    // Get swap usage from entitlements
    const swapsUsed = data?.usage?.activity_swaps ?? 0;
    const swapsRemaining = Math.max(0, FREE_TIER_LIMITS.maxActivitySwaps - swapsUsed);

    if (hasFullAccess) {
      return {
        maxVisibleDays: -1, // Unlimited
        canViewDay: () => true,
        maxActivitySwaps: -1,
        swapsRemaining: -1,
        canSwapActivity: true,
        canRegenerateDay: true,
        canExport: true,
        canShare: true,
        isFreeUser: false,
        isUnlocked: true,
      };
    }

    // Free tier limits
    return {
      maxVisibleDays: FREE_TIER_LIMITS.maxVisibleDays,
      canViewDay: (dayNumber: number) => dayNumber <= FREE_TIER_LIMITS.maxVisibleDays,
      maxActivitySwaps: FREE_TIER_LIMITS.maxActivitySwaps,
      swapsRemaining,
      canSwapActivity: swapsRemaining > 0,
      canRegenerateDay: FREE_TIER_LIMITS.canRegenerateDay,
      canExport: FREE_TIER_LIMITS.canExport,
      canShare: FREE_TIER_LIMITS.canShare,
      isFreeUser: true,
      isUnlocked: false,
    };
  }, [data, isPaid, tripId]);
}
