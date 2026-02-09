/**
 * Hook for fetching user badges
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserBadge {
  id: string;
  badge_type: string;
  awarded_at: string;
  source: string | null;
}

export function useUserBadges(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: ['user-badges', targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data, error } = await supabase
        .from('user_badges')
        .select('id, badge_type, awarded_at, source')
        .eq('user_id', targetId)
        .order('awarded_at', { ascending: false });

      if (error) { console.error('[useUserBadges] Error:', error); return []; }
      return (data || []) as UserBadge[];
    },
    enabled: !!targetId,
    staleTime: 5 * 60 * 1000,
  });
}

export const BADGE_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  club_voyager: { label: 'Voyager', icon: '🧭', color: 'text-blue-500' },
  club_explorer: { label: 'Explorer', icon: '🗺️', color: 'text-emerald-500' },
  club_adventurer: { label: 'Adventurer', icon: '⛰️', color: 'text-amber-500' },
  founding_member: { label: 'Founding Member', icon: '🏆', color: 'text-yellow-500' },
};

export default useUserBadges;
