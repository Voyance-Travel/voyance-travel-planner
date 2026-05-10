import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface DestinationData {
  id: string;
  city: string;
  enriched_at?: string | null;
  local_tips?: string[] | null;
  food_scene?: string | null;
  description?: string | null;
}

// Module-level dedup — shared across all hook instances in this tab.
// Prevents duplicate enrich-destination invocations when multiple components
// mount the same destination simultaneously. Cross-tab dedup is handled by
// the DB-side `enriched_at` guard inside the enrich-destination function.
const enrichInFlight = new Map<string, Promise<void>>();

/**
 * Detects "thin" database destinations and triggers AI enrichment.
 * Returns enrichment state so the page can show a shimmer/loading indicator.
 */
export function useDestinationEnrichment(
  dbDestination: DestinationData | null | undefined,
  isStaticDestination: boolean,
  hasActivities: boolean
) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentDone, setEnrichmentDone] = useState(false);
  const triggeredRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!dbDestination) return;
    if (isStaticDestination) return;

    // Already enriched in DB
    if ((dbDestination as any).enriched_at) return;

    // Already triggered for this destination
    if (triggeredRef.current === dbDestination.id) return;

    // Check if content is thin
    const isThin =
      (!dbDestination.local_tips || dbDestination.local_tips.length === 0) &&
      !dbDestination.food_scene &&
      !hasActivities;

    if (!isThin) return;

    triggeredRef.current = dbDestination.id;

    const key = dbDestination.id.toLowerCase();
    if (enrichInFlight.has(key)) {
      // Another mount is already enriching this destination. Skip the invoke;
      // the in-flight call will invalidate shared react-query caches on completion.
      return;
    }

    setIsEnriching(true);

    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('enrich-destination', {
          body: { destinationId: dbDestination.id },
        });

        if (error) {
          console.error('Enrichment error:', error);
          return;
        }

        if (data?.enriched || data?.skipped) {
          queryClient.invalidateQueries({ queryKey: ['destination-by-city'] });
          queryClient.invalidateQueries({ queryKey: ['activities-by-destination', dbDestination.id] });
          queryClient.invalidateQueries({ queryKey: ['attractions-by-destination', dbDestination.id] });
          setEnrichmentDone(true);
        }
      } catch (err) {
        console.error('Enrichment failed:', err);
      } finally {
        setIsEnriching(false);
        enrichInFlight.delete(key);
      }
    })();

    enrichInFlight.set(key, promise);
  }, [dbDestination?.id, isStaticDestination, hasActivities, queryClient]);

  return { isEnriching, enrichmentDone };
}
