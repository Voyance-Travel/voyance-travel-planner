/**
 * Hook to check per-trip free action cap status.
 * Returns whether the next use of an action is free or costs credits.
 *
 * Delegates all cost/cap logic to voyanceFlowController.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getActionCost, type UserTier } from '@/lib/voyanceFlowController';

type CappedAction = 'swap_activity' | 'regenerate_day' | 'ai_message' | 'restaurant_rec' | 'transport_mode_change';

export function useActionCap(tripId: string | undefined, actionType: CappedAction) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['action-cap', user?.id, tripId, actionType],
    queryFn: async () => {
      if (!user?.id || !tripId) return { usage_count: 0 };
      const { data, error } = await supabase
        .from('trip_action_usage')
        .select('usage_count')
        .eq('user_id', user.id)
        .eq('trip_id', tripId)
        .eq('action_type', actionType)
        .maybeSingle();
      if (error) {
        console.error('[useActionCap] Error:', error);
        return { usage_count: 0 };
      }
      return data ?? { usage_count: 0 };
    },
    enabled: !!user?.id && !!tripId,
    staleTime: 30_000,
  });

  const usedCount = data?.usage_count ?? 0;

  // Delegate to voyanceFlowController for all cost/cap logic
  const result = getActionCost(actionType, usedCount);

  return {
    isFree: result.isFree,
    usedCount: result.usedCount,
    freeRemaining: result.freeRemaining,
    cap: result.cap,
    creditCost: result.cost,
    isLoading,
  };
}
