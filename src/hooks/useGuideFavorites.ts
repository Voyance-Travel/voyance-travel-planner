/**
 * Hook to query guide_favorites count for a trip and community_guides status.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useGuideFavoritesCount(tripId: string | undefined) {
  return useQuery({
    queryKey: ['guide-favorites-count', tripId],
    queryFn: async () => {
      if (!tripId) return 0;
      const { count, error } = await supabase
        .from('guide_favorites')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!tripId,
    staleTime: 30_000,
  });
}

export function useCommunityGuideForTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: ['community-guide-trip', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data, error } = await supabase
        .from('community_guides')
        .select('id, status, slug')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
    staleTime: 30_000,
  });
}
