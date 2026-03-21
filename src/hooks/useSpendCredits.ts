/**
 * Hook for spending credits on actions.
 * On insufficient credits, triggers the global OutOfCreditsModal popup.
 */

import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CREDIT_COSTS } from '@/config/pricing';
import { useOutOfCredits } from '@/contexts/OutOfCreditsContext';

type ActionType = keyof typeof CREDIT_COSTS;

// Map config keys to API action names
const ACTION_MAP: Record<string, string> = {
  TRIP_GENERATION: 'trip_generation',
  HOTEL_SEARCH: 'hotel_search',
  UNLOCK_DAY: 'unlock_day',
  SMART_FINISH: 'smart_finish',
  SWAP_ACTIVITY: 'swap_activity',
  ADD_ACTIVITY: 'add_activity',
  REGENERATE_DAY: 'regenerate_day',
  RESTAURANT_REC: 'restaurant_rec',
  AI_MESSAGE: 'ai_message',
  HOTEL_OPTIMIZATION: 'hotel_optimization',
  MYSTERY_GETAWAY: 'mystery_getaway',
  MYSTERY_LOGISTICS: 'mystery_logistics',
  TRANSPORT_MODE_CHANGE: 'transport_mode_change',
  ROUTE_OPTIMIZATION: 'route_optimization',
  REGENERATE_TRIP: 'regenerate_trip',
  GENERATE_BLOG: 'generate_blog',
};

interface SpendCreditsParams {
  action: ActionType;
  tripId?: string;
  activityId?: string;
  dayIndex?: number;
  /** For variable-cost actions (trip_generation, hotel_search) */
  creditsAmount?: number;
  metadata?: Record<string, unknown>;
}

interface SpendCreditsResponse {
  success: boolean;
  spent: number;
  action: string;
  newBalance: {
    total: number;
    purchased: number;
    free: number;
  };
  // Free cap info (from tier-aware spend-credits)
  freeCapUsed?: boolean;
  usageCount?: number;
  freeCap?: number;
  // Group cap info
  groupCapUsed?: boolean;
  groupCap?: number;
}

export function useSpendCredits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { showOutOfCredits } = useOutOfCredits();
  const pendingRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: async (params: SpendCreditsParams): Promise<SpendCreditsResponse> => {
      if (!user) {
        throw new Error('Must be logged in to spend credits');
      }

      // Deduplication guard: prevent concurrent identical mutations
      const dedupeKey = `${params.action}-${params.tripId}-${params.creditsAmount}`;
      if (pendingRef.current === dedupeKey) {
        console.log('[SpendCredits] Skipping duplicate mutation:', dedupeKey);
        throw new Error('Duplicate spend request blocked');
      }
      pendingRef.current = dedupeKey;

      try {
        const apiAction = ACTION_MAP[params.action] || params.action.toLowerCase();

        const { data, error } = await supabase.functions.invoke('spend-credits', {
          body: {
            action: apiAction,
            tripId: params.tripId,
            activityId: params.activityId,
            dayIndex: params.dayIndex,
            creditsAmount: params.creditsAmount,
            metadata: params.metadata,
          },
        });

        if (error) {
          throw new Error(error.message || 'Failed to spend credits');
        }

        if (data.error) {
          if (data.error === 'Insufficient credits') {
            // Trigger the global out-of-credits modal
            showOutOfCredits({
              action: params.action,
              creditsNeeded: data.required ?? CREDIT_COSTS[params.action],
              creditsAvailable: data.available ?? 0,
              tripId: params.tripId,
            });
            throw new Error(`Not enough credits. Need ${data.required}, have ${data.available}.`);
          }
          throw new Error(data.error);
        }

        return data;
      } finally {
        pendingRef.current = null;
      }
    },
    retry: false, // CRITICAL: Disable React Query retries for credit mutations
    onSuccess: (data, variables) => {
      if (user?.id) {
        // Immediately update cache with server-returned balance to prevent flicker
        if (data.newBalance) {
          queryClient.setQueryData(['credits', user.id], (old: any) => {
            if (!old) return old;
            return {
              ...old,
              totalCredits: data.newBalance.total,
              purchasedCredits: data.newBalance.purchased,
              effectiveFreeCredits: data.newBalance.free,
              freeCredits: data.newBalance.free,
            };
          });
        }
        // Background refresh for full data consistency (purchases list, etc.)
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
        if (variables.tripId) {
          queryClient.invalidateQueries({ queryKey: ['action-cap', user.id, variables.tripId] });
        }
      }
    },
    onError: (error: Error) => {
      // Don't show toast for insufficient credits — the modal handles it
      if (error.message.startsWith('Not enough credits')) return;
      // Don't show toast for duplicate blocks
      if (error.message === 'Duplicate spend request blocked') return;
      
      toast({
        title: 'Action failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Check if user can afford an action
 */
export function canAffordAction(totalCredits: number, action: ActionType): boolean {
  const cost = CREDIT_COSTS[action];
  return totalCredits >= cost;
}

/**
 * Get the credit cost for an action
 */
export function getActionCost(action: ActionType): number {
  return CREDIT_COSTS[action];
}
