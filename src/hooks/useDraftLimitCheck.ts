/**
 * Draft Limit Check Hook
 * 
 * Enforces itinerary build limits based on user's subscription plan.
 * All tiers: 5 itineraries/month (free users see Day 1 only)
 */

import { useMemo } from 'react';
import { useEntitlements } from './useEntitlements';
import { FREE_TIER_LIMITS } from '@/config/pricing';

interface DraftLimitResult {
  /** Whether user can create a new itinerary */
  canCreateDraft: boolean;
  /** Current number of itineraries built this month */
  currentDrafts: number;
  /** Maximum allowed itineraries per month (-1 = unlimited) */
  maxDrafts: number;
  /** Remaining itinerary slots available */
  remaining: number;
  /** User-friendly message explaining the limit */
  message: string;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Suggested upgrade path if at limit */
  upgradePath: 'trip_pass' | 'credits' | null;
  /** Whether user is on free tier */
  isFreeUser: boolean;
}

export function useDraftLimitCheck(): DraftLimitResult {
  const { data, isLoading, isPaid } = useEntitlements();

  return useMemo(() => {
    if (isLoading || !data) {
      return {
        canCreateDraft: true, // Optimistic during loading
        currentDrafts: 0,
        maxDrafts: FREE_TIER_LIMITS.maxItinerariesPerMonth,
        remaining: FREE_TIER_LIMITS.maxItinerariesPerMonth,
        message: 'Loading...',
        isLoading: true,
        upgradePath: null,
        isFreeUser: true,
      };
    }

    const isFreeUser = !isPaid && !(data?.is_paid ?? false);
    
    // Paid users have unlimited itineraries
    if (!isFreeUser) {
      return {
        canCreateDraft: true,
        currentDrafts: 0,
        maxDrafts: -1,
        remaining: -1,
        message: 'Unlimited itineraries available',
        isLoading: false,
        upgradePath: null,
        isFreeUser: false,
      };
    }

    // Free tier: 5 itineraries/month
    const maxDrafts = FREE_TIER_LIMITS.maxItinerariesPerMonth;
    const itinerariesUsed = data?.usage?.itinerary_builds ?? 0;
    const remaining = Math.max(0, maxDrafts - itinerariesUsed);
    const canCreateDraft = remaining > 0;

    // Build message
    let message = '';
    if (canCreateDraft) {
      if (remaining === 1) {
        message = `Last free itinerary this month. Upgrade for full access.`;
      } else {
        message = `${remaining} free itineraries remaining this month`;
      }
    } else {
      message = "You've used all 5 free itineraries this month. Upgrade to continue.";
    }

    return {
      canCreateDraft,
      currentDrafts: itinerariesUsed,
      maxDrafts,
      remaining,
      message,
      isLoading: false,
      upgradePath: canCreateDraft ? null : 'trip_pass',
      isFreeUser: true,
    };
  }, [data, isLoading, isPaid]);
}

export default useDraftLimitCheck;
