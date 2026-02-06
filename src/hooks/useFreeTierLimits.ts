import { useMemo } from 'react';
import { useCredits } from './useCredits';
import { CREDIT_COSTS } from '@/config/pricing';

export interface FreeTierLimits {
  // Credit balance
  totalCredits: number;
  purchasedCredits: number;
  freeCredits: number;
  
  // Affordability checks
  canSwapActivity: boolean;
  canRegenerateDay: boolean;
  canSearchHotels: boolean;
  
  // Export/Share (always free)
  canExport: boolean;
  canShare: boolean;
  
  // Overall status
  needsCredits: boolean;
  isLoading: boolean;
}

/**
 * Hook to check credit-based limits for the current user.
 */
export function useFreeTierLimits(): FreeTierLimits {
  const { data, isLoading } = useCredits();

  return useMemo(() => {
    if (isLoading || !data) {
      return {
        totalCredits: 0,
        purchasedCredits: 0,
        freeCredits: 0,
        canSwapActivity: false,
        canRegenerateDay: false,
        canSearchHotels: false,
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
      canSwapActivity: totalCredits >= CREDIT_COSTS.SWAP_ACTIVITY,
      canRegenerateDay: totalCredits >= CREDIT_COSTS.REGENERATE_DAY,
      canSearchHotels: totalCredits >= CREDIT_COSTS.HOTEL_SEARCH,
      canExport: true,
      canShare: true,
      needsCredits: totalCredits < CREDIT_COSTS.SWAP_ACTIVITY,
      isLoading: false,
    };
  }, [data, isLoading]);
}
