/**
 * Hook for spending credits on actions
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CREDIT_COSTS } from '@/config/pricing';

type ActionType = keyof typeof CREDIT_COSTS;

// Map config keys to API action names
const ACTION_MAP: Record<string, string> = {
  TRIP_GENERATION: 'trip_generation',
  HOTEL_SEARCH: 'hotel_search',
  UNLOCK_DAY: 'unlock_day',
  SWAP_ACTIVITY: 'swap_activity',
  REGENERATE_DAY: 'regenerate_day',
  RESTAURANT_REC: 'restaurant_rec',
  AI_MESSAGE: 'ai_message',
  MYSTERY_GETAWAY: 'mystery_getaway',
  MYSTERY_LOGISTICS: 'mystery_logistics',
  TRANSPORT_MODE_CHANGE: 'transport_mode_change',
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
}

export function useSpendCredits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SpendCreditsParams): Promise<SpendCreditsResponse> => {
      if (!user) {
        throw new Error('Must be logged in to spend credits');
      }

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
          throw new Error(`Not enough credits. Need ${data.required}, have ${data.available}.`);
        }
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Action failed',
        description: error.message,
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
