import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to check if the user has budget alerts enabled.
 * Defaults to true for anonymous users.
 */
export function useBudgetAlerts() {
  const { user } = useAuth();
  const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPreference() {
      if (!user?.id) {
        // Default to true for anonymous users
        setBudgetAlertsEnabled(true);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('budget_alerts')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setBudgetAlertsEnabled(data.budget_alerts ?? true);
        }
      } catch (err) {
        console.error('[useBudgetAlerts] Error loading preference:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreference();
  }, [user?.id]);

  return { budgetAlertsEnabled, isLoading };
}
