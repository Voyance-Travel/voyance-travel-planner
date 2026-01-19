/**
 * Draft Limit Check Hook
 * 
 * Enforces draft trip limits based on user's subscription plan.
 * Free users: 1 draft, Monthly: 5 drafts, Yearly: unlimited
 */

import { useMemo } from 'react';
import { useEntitlements } from './useEntitlements';

interface DraftLimitResult {
  /** Whether user can create a new draft trip */
  canCreateDraft: boolean;
  /** Current number of draft trips */
  currentDrafts: number;
  /** Maximum allowed drafts (-1 = unlimited) */
  maxDrafts: number;
  /** Remaining draft slots available */
  remaining: number;
  /** User-friendly message explaining the limit */
  message: string;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Suggested upgrade path if at limit */
  upgradePath: 'monthly' | 'yearly' | null;
}

export function useDraftLimitCheck(): DraftLimitResult {
  const { data, isLoading } = useEntitlements();

  return useMemo(() => {
    if (isLoading || !data) {
      return {
        canCreateDraft: true, // Optimistic during loading
        currentDrafts: 0,
        maxDrafts: 1,
        remaining: 1,
        message: 'Loading...',
        isLoading: true,
        upgradePath: null,
      };
    }

    const limits = data.limits || {};
    const maxDrafts = limits.draftTrips ?? 1;
    const remaining = limits.draftTripsRemaining ?? 1;

    // Unlimited drafts
    if (maxDrafts === -1) {
      return {
        canCreateDraft: true,
        currentDrafts: 0, // Not tracked for unlimited
        maxDrafts: -1,
        remaining: -1,
        message: 'Unlimited draft trips available',
        isLoading: false,
        upgradePath: null,
      };
    }

    const currentDrafts = maxDrafts - remaining;
    const canCreateDraft = remaining > 0;

    // Determine upgrade path
    let upgradePath: 'monthly' | 'yearly' | null = null;
    if (!canCreateDraft) {
      const plan = data.plans?.[0] || 'free';
      if (plan === 'free') {
        upgradePath = 'monthly';
      } else if (plan === 'monthly') {
        upgradePath = 'yearly';
      }
    }

    // Build message
    let message = '';
    if (canCreateDraft) {
      if (remaining === 1) {
        message = `${remaining} draft trip slot remaining`;
      } else {
        message = `${remaining} draft trip slots remaining`;
      }
    } else {
      if (maxDrafts === 1) {
        message = "You've reached your free draft limit. Upgrade for more.";
      } else {
        message = `You've reached your ${maxDrafts} draft trip limit. Upgrade to Yearly for unlimited.`;
      }
    }

    return {
      canCreateDraft,
      currentDrafts,
      maxDrafts,
      remaining,
      message,
      isLoading: false,
      upgradePath,
    };
  }, [data, isLoading]);
}

export default useDraftLimitCheck;
