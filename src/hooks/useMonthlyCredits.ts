/**
 * Hook to check and grant monthly free credits on app load
 * Calls the grant-monthly-credits edge function once per session
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

export function useMonthlyCredits() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check once per session and only if user is logged in
    if (!user || hasChecked.current) return;
    
    hasChecked.current = true;

    const checkMonthlyCredits = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await supabase.functions.invoke('grant-monthly-credits', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.data?.granted) {
          console.log('[useMonthlyCredits] Granted monthly credits:', response.data.amount);
          // Invalidate credits query to refresh balance
          queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
        }
      } catch (error) {
        // Silent fail - don't block the app if monthly credits check fails
        console.error('[useMonthlyCredits] Error checking monthly credits:', error);
      }
    };

    checkMonthlyCredits();
  }, [user, queryClient]);
}

export default useMonthlyCredits;
