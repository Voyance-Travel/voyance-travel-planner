import { useMemo } from 'react';
import { useCredits } from './useCredits';
import { CREDIT_COSTS } from '@/config/pricing';

export interface FreeTierLimits {
  // Credit balance
  totalCredits: number;
  purchasedCredits: number;
  freeCredits: number;
  
  // Affordability checks
  canUnlockDay: boolean;
  canSwapActivity: boolean;
  canRegenerateDay: boolean;
  canGetRestaurantRec: boolean;
  canSendAiMessage: boolean;
  
  // Day calculations
  daysAffordable: number;
  
  // Export/Share (always free)
  canExport: boolean;
  canShare: boolean;
  
  // Overall status
  needsCredits: boolean;
  isLoading: boolean;
}

/**
 * Hook to check credit-based limits for the current user.
 * Everything is gated by credits - no separate limits to track.
 */
export function useFreeTierLimits(): FreeTierLimits {
  const { data, isLoading } = useCredits();

  return useMemo(() => {
    if (isLoading || !data) {
      return {
        totalCredits: 0,
        purchasedCredits: 0,
        freeCredits: 0,
        canUnlockDay: false,
        canSwapActivity: false,
        canRegenerateDay: false,
        canGetRestaurantRec: false,
        canSendAiMessage: false,
        daysAffordable: 0,
        canExport: true,
        canShare: true,
        needsCredits: true,
        isLoading: true,
      };
    }

    const totalCredits = data.totalCredits;
    const purchasedCredits = data.purchasedCredits;
    const freeCredits = data.effectiveFreeCredits;

    return {
      totalCredits,
      purchasedCredits,
      freeCredits,
      canUnlockDay: totalCredits >= CREDIT_COSTS.UNLOCK_DAY,
      canSwapActivity: totalCredits >= CREDIT_COSTS.SWAP_ACTIVITY,
      canRegenerateDay: totalCredits >= CREDIT_COSTS.REGENERATE_DAY,
      canGetRestaurantRec: totalCredits >= CREDIT_COSTS.RESTAURANT_REC,
      canSendAiMessage: totalCredits >= CREDIT_COSTS.AI_MESSAGE,
      daysAffordable: Math.floor(totalCredits / CREDIT_COSTS.UNLOCK_DAY),
      canExport: true, // Always free
      canShare: true, // Always free
      needsCredits: totalCredits < CREDIT_COSTS.UNLOCK_DAY,
      isLoading: false,
    };
  }, [data, isLoading]);
}
