import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SNAPSHOT_KEY_PREFIX = 'voyance:itin-snapshot:';
const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DESTRUCTION_THRESHOLD_DAYS = 1; // tolerate +/- 0 days
const DESTRUCTION_THRESHOLD_DINING_PCT = 0.5; // restore if dining drops by 50%+

interface Snapshot {
  itinerary: any;
  dayCount: number;
  diningCount: number;
  costCents: number;
  savedAt: number;
}

function countDining(days: any[]): number {
  let count = 0;
  for (const d of days || []) {
    for (const a of (d?.activities || [])) {
      const cat = String(a?.category || '').toLowerCase();
      if (cat.includes('dining') || cat.includes('food') || cat.includes('restaurant')) count++;
      else if (/^(breakfast|brunch|lunch|dinner)\b/i.test(String(a?.title || ''))) count++;
    }
  }
  return count;
}

function takeSnapshot(itinerary: any): Snapshot {
  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
  return {
    itinerary,
    dayCount: days.length,
    diningCount: countDining(days),
    costCents: Number(itinerary?.totalCostCents || itinerary?.trip_total_cents || 0),
    savedAt: Date.now(),
  };
}

function isDestructive(prev: Snapshot, next: { dayCount: number; diningCount: number }): boolean {
  if (prev.dayCount - next.dayCount > DESTRUCTION_THRESHOLD_DAYS) return true;
  if (prev.diningCount > 0 && next.diningCount / prev.diningCount < DESTRUCTION_THRESHOLD_DINING_PCT) return true;
  return false;
}

export function useItineraryPreservation(tripId: string | undefined, trip: any): void {
  const restoredOnceRef = useRef(false);

  // 1. Snapshot whenever a healthy itinerary is rendered.
  useEffect(() => {
    if (!tripId || !trip?.itinerary_data) return;
    const days = (trip.itinerary_data as any)?.days || [];
    if (days.length === 0) return;
    const snap = takeSnapshot(trip.itinerary_data);
    if (snap.diningCount === 0 && snap.dayCount <= 1) return; // don't snapshot empty/loading state
    try {
      sessionStorage.setItem(SNAPSHOT_KEY_PREFIX + tripId, JSON.stringify(snap));
    } catch (e) {
      console.warn('[ItineraryPreservation] snapshot failed:', e);
    }
  }, [tripId, trip?.itinerary_data]);

  // 2. On mount + on trip changes, compare current state vs last snapshot.
  // If destructive change detected within TTL, restore.
  useEffect(() => {
    if (!tripId || !trip?.itinerary_data || restoredOnceRef.current) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(SNAPSHOT_KEY_PREFIX + tripId); } catch { return; }
    if (!raw) return;
    let prev: Snapshot;
    try { prev = JSON.parse(raw); } catch { return; }
    if (Date.now() - prev.savedAt > SNAPSHOT_TTL_MS) {
      try { sessionStorage.removeItem(SNAPSHOT_KEY_PREFIX + tripId); } catch {}
      return;
    }
    const currentDays = (trip.itinerary_data as any)?.days || [];
    const current = {
      dayCount: currentDays.length,
      diningCount: countDining(currentDays),
    };
    if (!isDestructive(prev, current)) return;

    restoredOnceRef.current = true;
    console.warn(`[ItineraryPreservation] Destructive change detected. prev=${prev.dayCount}d/${prev.diningCount}dining current=${current.dayCount}d/${current.diningCount}dining — restoring snapshot.`);
    // Restore via direct DB write to bypass save pipeline mutations.
    (async () => {
      try {
        const { error } = await supabase
          .from('trips')
          .update({ itinerary_data: prev.itinerary, updated_at: new Date().toISOString() })
          .eq('id', tripId);
        if (error) throw error;
        toast.warning('Detected unexpected itinerary change - restored your previous version.', {
          description: 'Reload the page to see the restored itinerary.',
          duration: 10000,
        });
      } catch (e) {
        console.error('[ItineraryPreservation] restore failed:', e);
      }
    })();
  }, [tripId, trip?.itinerary_data]);
}
