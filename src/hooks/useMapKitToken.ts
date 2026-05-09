import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches an Apple MapKit JWT from the `mapkit-token` edge function and
 * refreshes it every 50 minutes (Apple tokens are valid ~60 min, so we
 * refresh with a 10-minute buffer).
 *
 * Most consumers should use `loadMapKit()` from `@/utils/mapkit` — it wires
 * MapKit's own `authorizationCallback` to the same refresh logic. Use this
 * hook only when a React component needs the raw token string.
 */
export function useMapKitToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mapkit-token');
        if (error) throw error;
        if (isMounted) setToken(data?.token || null);
      } catch (err) {
        console.error('[useMapKitToken] Failed to fetch token:', err);
      }
    };

    // Initial fetch
    fetchToken();

    // Refresh every 50 minutes (token TTL is 60 min — refresh with 10 min buffer)
    intervalId = setInterval(fetchToken, 50 * 60 * 1000);

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return token;
}
