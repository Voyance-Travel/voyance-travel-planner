/**
 * useIsAdmin — server-checked admin role for the current user.
 *
 * Reads `user_roles` (the same source the admin data hooks use, e.g.
 * useAdminMetrics / useRealCostMetrics). Used to gate admin ROUTES so non-admins
 * never load admin pages (which can carry sensitive content like the cost/margin
 * table). The live admin data is independently RLS/role-protected server-side —
 * this is the client-side route gate (defense in depth + no UI/static leak).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useIsAdmin() {
  const query = useQuery({
    queryKey: ['is-admin'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .limit(1);
      if (error) {
        console.error('[useIsAdmin] role check failed:', error.message);
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return { isAdmin: query.data === true, isLoading: query.isLoading };
}
