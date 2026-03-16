/**
 * useActivityImageWriteback
 * 
 * Collects resolved photo URLs during the itinerary render cycle, then
 * batch-updates itinerary_data.days[].activities[].photos on the trips table.
 * 
 * This closes the persist/read disconnect: previously photos were written to
 * trip_activities (which nothing reads) while the UI reads from itinerary_data.
 * Without this, every page view triggered ~30-50 Google Places API calls.
 */

import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ResolvedPhoto {
  activityId: string;
  photoUrl: string;
}

const DEBOUNCE_MS = 4000; // 4s — enough for all activities to resolve

/**
 * Hook that accepts a tripId and returns a `reportPhoto` callback.
 * Call reportPhoto(activityId, url) whenever an activity image resolves.
 * After a debounce, all new photos are batch-written into itinerary_data.
 */
export function useActivityImageWriteback(tripId: string | undefined) {
  const pendingRef = useRef<Map<string, string>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingRef = useRef(false);

  const flush = useCallback(async () => {
    if (!tripId || pendingRef.current.size === 0 || writingRef.current) return;

    const photosToWrite = new Map(pendingRef.current);
    pendingRef.current.clear();
    writingRef.current = true;

    try {
      // Fetch current itinerary_data
      const { data: tripRow, error: fetchErr } = await supabase
        .from('trips')
        .select('itinerary_data')
        .eq('id', tripId)
        .single();

      if (fetchErr || !tripRow?.itinerary_data) {
        writingRef.current = false;
        return;
      }

      const itData = tripRow.itinerary_data as any;
      if (!itData?.days || !Array.isArray(itData.days)) {
        writingRef.current = false;
        return;
      }

      let changed = false;

      const updatedDays = itData.days.map((day: any) => {
        if (!day.activities || !Array.isArray(day.activities)) return day;

        const updatedActivities = day.activities.map((act: any) => {
          const newUrl = photosToWrite.get(act.id);
          if (!newUrl) return act;

          // Skip if already has the same photo
          const existing = act.image_url || (act.photos?.[0]?.url ?? act.photos?.[0]);
          if (existing === newUrl) return act;

          changed = true;
          return {
            ...act,
            image_url: newUrl,
            photos: [newUrl],
          };
        });

        return { ...day, activities: updatedActivities };
      });

      if (!changed) {
        writingRef.current = false;
        return;
      }

      const updatedItData = { ...itData, days: updatedDays };

      const { error: updateErr } = await supabase
        .from('trips')
        .update({
          itinerary_data: updatedItData as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (updateErr) {
        console.warn('[ImageWriteback] Failed to persist photos:', updateErr.message);
      } else {
        console.log(`[ImageWriteback] ✅ Persisted ${photosToWrite.size} photos to itinerary_data`);
      }
    } catch (err) {
      console.warn('[ImageWriteback] Error:', err);
    } finally {
      writingRef.current = false;
    }
  }, [tripId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reportPhoto = useCallback(
    (activityId: string, photoUrl: string) => {
      if (!tripId || !activityId || !photoUrl) return;
      // Skip fallback/gradient data URIs
      if (photoUrl.startsWith('data:')) return;

      pendingRef.current.set(activityId, photoUrl);

      // Reset debounce timer
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [tripId, flush]
  );

  return { reportPhoto };
}
