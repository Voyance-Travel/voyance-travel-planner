/**
 * Hook to check per-trip free action cap status.
 * Returns whether the next use of an action is free or costs credits.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CREDIT_COSTS, FREE_ACTION_CAPS } from '@/config/pricing';

type CappedAction = 'swap_activity' | 'regenerate_day' | 'ai_message' | 'restaurant_rec' | 'transport_mode_change';

const ACTION_TO_COST_KEY: Record<CappedAction, keyof typeof CREDIT_COSTS> = {
  swap_activity: 'SWAP_ACTIVITY',
  regenerate_day: 'REGENERATE_DAY',
  ai_message: 'AI_MESSAGE',
  restaurant_rec: 'RESTAURANT_REC',
  transport_mode_change: 'TRANSPORT_MODE_CHANGE',
};

export function useActionCap(tripId: string | undefined, actionType: CappedAction) {
  const { user } = useAuth();
  const cap = FREE_ACTION_CAPS[actionType] ?? 0;
  const creditCost = CREDIT_COSTS[ACTION_TO_COST_KEY[actionType]];

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
  const freeRemaining = Math.max(0, cap - usedCount);
  const isFree = freeRemaining > 0;

  return {
    isFree,
    usedCount,
    freeRemaining,
    cap,
    creditCost: isFree ? 0 : creditCost,
    isLoading,
  };
}
