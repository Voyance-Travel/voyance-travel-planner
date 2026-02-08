import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDestinationSkippedItems } from '@/utils/intelligenceAnalytics';
import type { SkippedItem } from '@/components/itinerary/WhyWeSkippedSection';

/**
 * Hook that fetches AI-generated skip list for any destination,
 * falling back to hardcoded lists for known cities.
 * Caches results in sessionStorage to avoid repeated calls.
 */
export function useSkipList(destination: string) {
  const cacheKey = `voyance_skiplist_${destination.toLowerCase().trim()}`;
  const [skippedItems, setSkippedItems] = useState<SkippedItem[]>(() => {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fall through */ }
    }
    return getDestinationSkippedItems(destination);
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!destination) return;

    // If we already have cached AI results, skip
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return;

    // If we have hardcoded results, use those but still try to fetch richer AI ones
    const hardcoded = getDestinationSkippedItems(destination);
    if (hardcoded.length > 0) {
      setSkippedItems(hardcoded);
    }

    // Fetch AI-generated skip list in background
    const fetchSkipList = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-skip-list', {
          body: { destination },
        });

        if (!error && data?.skippedItems?.length > 0) {
          setSkippedItems(data.skippedItems);
          sessionStorage.setItem(cacheKey, JSON.stringify(data.skippedItems));
        }
      } catch (err) {
        console.warn('[useSkipList] Failed to fetch, using fallback:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSkipList();
  }, [destination, cacheKey]);

  return { skippedItems, isLoading };
}
