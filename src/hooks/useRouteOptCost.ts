/**
 * Hook to determine the current route optimization credit cost for a trip.
 * Queries trip_action_usage for the optimization count and combines with
 * the user's tier to return the sliding-scale cost.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEntitlements } from '@/hooks/useEntitlements';
import { getRouteOptimizationCost } from '@/lib/voyanceFlowController';
import type { UserTier } from '@/config/pricing';

export function useRouteOptCost(tripId: string) {
  const { user } = useAuth();
  const { data: entitlements } = useEntitlements(tripId);

  const { data: usageData } = useQuery({
    queryKey: ['route-opt-usage', user?.id, tripId],
    queryFn: async () => {
      if (!user?.id || !tripId) return { usage_count: 0 };
      const { data } = await supabase
        .from('trip_action_usage')
        .select('usage_count')
        .eq('user_id', user.id)
        .eq('trip_id', tripId)
        .eq('action_type', 'route_optimization')
        .maybeSingle();
      return data ?? { usage_count: 0 };
    },
    enabled: !!user?.id && !!tripId,
    staleTime: 30_000,
  });

  const optimizeCount = usageData?.usage_count ?? 0;
  const tier = (entitlements?.tier as UserTier) ?? 'free';
  const isFirstTrip = entitlements?.is_first_trip ?? false;
  const cost = isFirstTrip ? 0 : getRouteOptimizationCost(optimizeCount, tier);

  return {
    cost,
    optimizeCount,
    isFirstTrip,
    tier,
  };
}
