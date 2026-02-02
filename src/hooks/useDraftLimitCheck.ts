/**
 * Draft Limit Check Hook
 * 
 * Enforces itinerary build limits based on user's credit balance.
 * Users can build unlimited itineraries, but need credits to unlock days.
 */

import { useMemo } from 'react';
import { useCredits } from './useCredits';
import { CREDIT_COSTS } from '@/config/pricing';

interface DraftLimitResult {
  /** Whether user can create a new itinerary (always true - credits just gate day unlocks) */
  canCreateDraft: boolean;
  /** Current credit balance */
  currentCredits: number;
  /** Whether user can unlock at least one day */
  canUnlockDay: boolean;
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
        canUnlockDay: false,
        message: 'Loading...',
        isLoading: true,
        needsCredits: false,
      };
    }

    const currentCredits = data.totalCredits;
    const canUnlockDay = currentCredits >= CREDIT_COSTS.UNLOCK_DAY;

    // Users can always create drafts - credits just gate day unlocks
    let message = '';
    if (canUnlockDay) {
      const daysAffordable = Math.floor(currentCredits / CREDIT_COSTS.UNLOCK_DAY);
      message = `You can unlock ${daysAffordable} day${daysAffordable !== 1 ? 's' : ''} with your credits`;
    } else {
      message = `You need ${CREDIT_COSTS.UNLOCK_DAY} credits to unlock a day. You have ${currentCredits}.`;
    }

    return {
      canCreateDraft: true, // Always allow draft creation
      currentCredits,
      canUnlockDay,
      message,
      isLoading: false,
      needsCredits: !canUnlockDay,
    };
  }, [data, isLoading]);
}

export default useDraftLimitCheck;
