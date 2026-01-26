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
  maxRegenerates: number;
  regeneratesRemaining: number;
  canRegenerateDay: boolean;
  
  // Itinerary builds
  maxItinerariesPerMonth: number;
  itinerariesRemaining: number;
  canBuildItinerary: boolean;
  
  // Export/Share
  canExport: boolean;
  canShare: boolean;
  
  // Overall status
  isFreeUser: boolean;
  isUnlocked: boolean; // Has Trip Pass or credits
}

/**
 * Hook to check free tier limits for the current user.
 * Free users: 5 itineraries/month, Day 1 only, 3 swaps, 3 regenerates
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

    // Get usage from entitlements
    const swapsUsed = data?.usage?.activity_swaps ?? 0;
    const swapsRemaining = Math.max(0, FREE_TIER_LIMITS.maxActivitySwaps - swapsUsed);
    
    const regeneratesUsed = data?.usage?.day_regenerates ?? 0;
    const regeneratesRemaining = Math.max(0, FREE_TIER_LIMITS.maxRegenerates - regeneratesUsed);
    
    const itinerariesUsed = data?.usage?.itinerary_builds ?? 0;
    const itinerariesRemaining = Math.max(0, FREE_TIER_LIMITS.maxItinerariesPerMonth - itinerariesUsed);

    if (hasFullAccess) {
      return {
        maxVisibleDays: -1, // Unlimited
        canViewDay: () => true,
        maxActivitySwaps: -1,
        swapsRemaining: -1,
        canSwapActivity: true,
        maxRegenerates: -1,
        regeneratesRemaining: -1,
        canRegenerateDay: true,
        maxItinerariesPerMonth: -1,
        itinerariesRemaining: -1,
        canBuildItinerary: true,
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
      maxRegenerates: FREE_TIER_LIMITS.maxRegenerates,
      regeneratesRemaining,
      canRegenerateDay: regeneratesRemaining > 0,
      maxItinerariesPerMonth: FREE_TIER_LIMITS.maxItinerariesPerMonth,
      itinerariesRemaining,
      canBuildItinerary: itinerariesRemaining > 0,
      canExport: FREE_TIER_LIMITS.canExport,
      canShare: FREE_TIER_LIMITS.canShare,
      isFreeUser: true,
      isUnlocked: false,
    };
  }, [data, isPaid, tripId]);
}
