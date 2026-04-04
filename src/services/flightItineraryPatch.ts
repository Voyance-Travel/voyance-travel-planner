/**
 * Flight → Itinerary Patch
 * 
 * When a flight is added/changed after generation, adjusts Day 1 and last day
 * activities to respect actual arrival/departure times.
 * 
 * Accepts the actual flight_selection schema (legacy {departure, return} or
 * new {legs}) and uses normalizeFlightSelection for consistent access.
 */

import { supabase } from '@/integrations/supabase/client';
import { saveItineraryOptimistic, fetchAndCacheVersion } from '@/services/itineraryOptimisticUpdate';
import { getFirstLegArrivalTime, getLastLegDepartureTime } from '@/utils/normalizeFlightSelection';
import { cascadeFixOverlaps } from '@/utils/injectHotelActivities';

/**
 * Normalize time strings ("2:30 PM" or "14:30") to "HH:MM" 24hr format
 */
function normalize24h(t: string): string | null {
  if (!t) return null;
  const cleaned = t.trim().toUpperCase();

  // Try HH:MM 24hr
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // Try 12hr format
  const match12 = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const ampm = match12[3];
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const ARRIVAL_KEYWORDS = ['arrival', 'land', 'airport', 'arrive', 'flight in', 'touch down'];
const DEPARTURE_KEYWORDS = ['departure', 'depart', 'flight out', 'head to airport', 'airport transfer', 'leave for airport'];

function isArrivalActivity(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return ARRIVAL_KEYWORDS.some(k => lower.includes(k));
}

function isDepartureActivity(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return DEPARTURE_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Patch itinerary_data Day 1 and last day with flight times.
 * 
 * Accepts the raw flight_selection object (any shape — legacy or legs[]).
 * Uses normalizeFlightSelection helpers to extract arrival/departure times.
 * Uses saveItineraryOptimistic for concurrent-edit safety.
 */
export async function patchItineraryWithFlight(
  tripId: string,
  flightSelection: unknown,
): Promise<boolean> {
  try {
    // Extract times using the normalizer (handles all flight_selection shapes)
    const arrivalTimeRaw = getFirstLegArrivalTime(flightSelection);
    const departureTimeRaw = getLastLegDepartureTime(flightSelection);

    if (!arrivalTimeRaw && !departureTimeRaw) {
      console.log('[FlightPatch] No arrival or departure time found in flight selection');
      return false;
    }

    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();

    if (fetchError || !trip?.itinerary_data) return false;

    const itineraryData = trip.itinerary_data as Record<string, unknown>;
    const days = itineraryData.days as Array<Record<string, unknown>> | undefined;
    if (!days?.length) return false;

    let patched = false;

    // Patch Day 1 with arrival time
    if (arrivalTimeRaw) {
      const arrivalNorm = normalize24h(arrivalTimeRaw);
      if (arrivalNorm) {
        const day1 = days[0];
        const activities = day1.activities as Array<Record<string, unknown>> | undefined;
        if (activities?.length) {
          const arrivalMins = timeToMinutes(arrivalNorm);
          const earliestStart = arrivalMins + 30;

          for (const act of activities) {
            const title = String(act.title || act.name || '');
            if (isArrivalActivity(title)) {
              act.start_time = arrivalNorm;
              act.end_time = minutesToTime(arrivalMins + 30);
              patched = true;
              continue;
            }

            const actTime = normalize24h(String(act.start_time || ''));
            if (actTime && timeToMinutes(actTime) < earliestStart) {
              const duration = act.end_time
                ? timeToMinutes(normalize24h(String(act.end_time)) || actTime) - timeToMinutes(actTime)
                : 60;
              act.start_time = minutesToTime(earliestStart);
              act.end_time = minutesToTime(earliestStart + Math.max(duration, 30));
              patched = true;
            }
          }
        }
        // GAP 3: Cascade fix overlaps on Day 1 after flight patch
        day1.activities = cascadeFixOverlaps(activities as any) as any;
        patched = true;
      }
    }

    // Patch last day with departure time
    if (departureTimeRaw) {
      const departNorm = normalize24h(departureTimeRaw);
      if (departNorm) {
        const lastDay = days[days.length - 1];
        const activities = lastDay.activities as Array<Record<string, unknown>> | undefined;
        if (activities?.length) {
          const departMins = timeToMinutes(departNorm);
          const latestEnd = departMins - 180;
          const transferStart = departMins - 210;

          for (const act of activities) {
            const title = String(act.title || act.name || '');
            if (isDepartureActivity(title)) {
              act.start_time = minutesToTime(Math.max(transferStart, 0));
              act.end_time = departNorm;
              patched = true;
              continue;
            }

            const actEndStr = normalize24h(String(act.end_time || ''));
            if (actEndStr && timeToMinutes(actEndStr) > latestEnd && latestEnd > 0) {
              act.end_time = minutesToTime(latestEnd);
              patched = true;
            }
          }
        }
      }
    }

    if (!patched) return false;

    // Use optimistic update for version safety
    await fetchAndCacheVersion(tripId);
    const result = await saveItineraryOptimistic(tripId, { ...itineraryData, days });

    if (!result.success) {
      console.error('[FlightPatch] Optimistic update failed:', result.error);
      return false;
    }

    console.log('[FlightPatch] Patched Day 1/last day with flight times');
    return true;
  } catch (err) {
    console.error('[FlightPatch] Error:', err);
    return false;
  }
}
