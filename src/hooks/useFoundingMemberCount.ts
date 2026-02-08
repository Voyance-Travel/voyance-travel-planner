/**
 * Hook to fetch the current founding member count (out of 1,000 cap).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const FOUNDING_MEMBER_CAP = 1000;

export function useFoundingMemberCount() {
  const { data, isLoading } = useQuery({
    queryKey: ['founding-member-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_founding_member_count');
      if (error) {
        console.error('[FoundingMember] Count error:', error);
        return 0;
      }
      return (data as number) ?? 0;
    },
    staleTime: 60_000, // 1 minute
  });

  const count = data ?? 0;
  const remaining = Math.max(0, FOUNDING_MEMBER_CAP - count);
  const isSoldOut = remaining === 0;

  return {
    count,
    remaining,
    cap: FOUNDING_MEMBER_CAP,
    isSoldOut,
    isLoading,
  };
}
