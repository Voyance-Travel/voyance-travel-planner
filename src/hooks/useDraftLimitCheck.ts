/**
 * Draft Limit Check Hook
 * 
 * Enforces itinerary build limits based on user's credit balance.
 * Users can build unlimited itineraries, but need credits to generate trips.
 */

import { useMemo } from 'react';
import { useCredits } from './useCredits';
import { CREDIT_COSTS } from '@/config/pricing';

interface DraftLimitResult {
  /** Whether user can create a new itinerary (always true) */
  canCreateDraft: boolean;
  /** Current credit balance */
  currentCredits: number;
  /** Whether user can afford at least a swap */
  canAffordAction: boolean;
  /** User-friendly message */
  message: string;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Whether user needs more credits */
  needsCredits: boolean;
}

export function useDraftLimitCheck(): DraftLimitResult {
  const { data, isLoading } = useCredits();

  return useMemo(() => {
    if (isLoading || !data) {
      return {
        canCreateDraft: true,
        currentCredits: 0,
        canAffordAction: false,
        message: 'Loading...',
        isLoading: true,
        needsCredits: false,
      };
    }

    const currentCredits = data.totalCredits;
    // Minimum useful action is a swap at 15 credits
    const minActionCost = CREDIT_COSTS.SWAP_ACTIVITY;
    const canAffordAction = currentCredits >= minActionCost;

    let message = '';
    if (currentCredits > 0) {
      message = `You have ${currentCredits} credits available`;
    } else {
      message = 'You need credits to generate trips and use premium features.';
    }

    return {
      canCreateDraft: true,
      currentCredits,
      canAffordAction,
      message,
      isLoading: false,
      needsCredits: currentCredits === 0,
    };
  }, [data, isLoading]);
}

export default useDraftLimitCheck;
