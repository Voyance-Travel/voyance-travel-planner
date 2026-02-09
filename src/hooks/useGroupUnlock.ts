/**
 * Hook for checking group unlock status on a trip
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface GroupUnlock {
  id: string;
  trip_id: string;
  purchased_by: string;
  tier: string;
  caps: Record<string, number>;
  usage: Record<string, number>;
  created_at: string;
}

async function fetchGroupUnlock(tripId: string | undefined): Promise<GroupUnlock | null> {
  if (!tripId) return null;

  const { data, error } = await supabase
    .from('group_unlocks')
    .select('*')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (error) {
    console.error('[useGroupUnlock] Error:', error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    trip_id: data.trip_id,
    purchased_by: data.purchased_by,
    tier: data.tier,
    caps: (data.caps as Record<string, number>) || {},
    usage: (data.usage as Record<string, number>) || {},
    created_at: data.created_at,
  };
}

export function useGroupUnlock(tripId: string | undefined) {
  return useQuery({
    queryKey: ['group-unlock', tripId],
    queryFn: () => fetchGroupUnlock(tripId),
    enabled: !!tripId,
    staleTime: 60 * 1000,
  });
}

export function getGroupCapRemaining(unlock: GroupUnlock | null, action: string): number {
  if (!unlock) return 0;
  const cap = unlock.caps[action] || 0;
  const used = unlock.usage[action] || 0;
  return Math.max(0, cap - used);
}

export default useGroupUnlock;
