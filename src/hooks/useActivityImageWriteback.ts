/**
 * useActivityImageWriteback
 * 
 * Collects resolved photo URLs during the itinerary render cycle, then
 * merges them into the parent component's days state via a callback.
 * 
 * This ensures photos travel with the itinerary data through ALL save
 * paths (drag-drop, edit, add/remove) instead of being overwritten by
 * a separate direct DB write.
 */

import { useRef, useCallback, useEffect } from 'react';

const DEBOUNCE_MS = 2000;

/**
 * Hook that accepts a callback to update the days state.
 * Call reportPhoto(activityId, url) whenever an activity image resolves.
 * After a debounce, all new photos are merged into the days state.
 */
export function useActivityImageWriteback(
  onMergePhotos?: (photos: Map<string, string>) => void
) {
  const pendingRef = useRef<Map<string, string>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onMergePhotos);

  // Keep callback ref fresh without re-creating reportPhoto
  useEffect(() => {
    callbackRef.current = onMergePhotos;
  }, [onMergePhotos]);

  const flush = useCallback(() => {
    if (pendingRef.current.size === 0 || !callbackRef.current) return;

    const photosToMerge = new Map(pendingRef.current);
    pendingRef.current.clear();

    callbackRef.current(photosToMerge);
    console.log(`[ImageWriteback] ✅ Merged ${photosToMerge.size} photos into state`);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reportPhoto = useCallback(
    (activityId: string, photoUrl: string) => {
      if (!activityId || !photoUrl) return;
      // Skip fallback/gradient data URIs
      if (photoUrl.startsWith('data:')) return;

      pendingRef.current.set(activityId, photoUrl);

      // Reset debounce timer
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, DEBOUNCE_MS);
    },
    [flush]
  );

  return { reportPhoto };
}
