/**
 * Flight → Itinerary Patch
 * 
 * When a flight is added/changed after generation, adjusts Day 1 and last day
 * activities to respect actual arrival/departure times.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

interface FlightInfo {
  departureTime?: string; // e.g. "14:30" or "2:30 PM"
  arrivalTime?: string;
}

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
  const lower = title.toLowerCase();
  return ARRIVAL_KEYWORDS.some(k => lower.includes(k));
}

function isDepartureActivity(title: string): boolean {
  const lower = title.toLowerCase();
  return DEPARTURE_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Patch itinerary_data Day 1 and last day with flight times.
 * - Day 1: Adjusts arrival-related activities to match inbound flight arrival
 * - Last day: Adjusts departure-related activities to match outbound flight departure
 */
export async function patchItineraryWithFlight(
  tripId: string,
  flight: {
    outbound?: FlightInfo;
    return?: FlightInfo;
  },
): Promise<boolean> {
  try {
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

    // Patch Day 1 with outbound arrival
    if (flight.outbound?.arrivalTime) {
      const arrivalNorm = normalize24h(flight.outbound.arrivalTime);
      if (arrivalNorm) {
        const day1 = days[0];
        const activities = day1.activities as Array<Record<string, unknown>> | undefined;
        if (activities?.length) {
          const arrivalMins = timeToMinutes(arrivalNorm);
          // Buffer: earliest activity should start 30min after arrival
          const earliestStart = arrivalMins + 30;

          for (const act of activities) {
            const title = String(act.title || act.name || '');
            if (isArrivalActivity(title)) {
              act.start_time = arrivalNorm;
              act.end_time = minutesToTime(arrivalMins + 30);
              patched = true;
              continue;
            }

            // Shift activities that are before earliest allowed start
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
      }
    }

    // Patch last day with return departure
    if (flight.return?.departureTime) {
      const departNorm = normalize24h(flight.return.departureTime);
      if (departNorm) {
        const lastDay = days[days.length - 1];
        const activities = lastDay.activities as Array<Record<string, unknown>> | undefined;
        if (activities?.length) {
          const departMins = timeToMinutes(departNorm);
          // Buffer: need to be at airport 2hrs before
          const latestEnd = departMins - 120;
          // Airport transfer should start 2.5hrs before
          const transferStart = departMins - 150;

          for (const act of activities) {
            const title = String(act.title || act.name || '');
            if (isDepartureActivity(title)) {
              act.start_time = minutesToTime(Math.max(transferStart, 0));
              act.end_time = departNorm;
              patched = true;
              continue;
            }

            // Trim activities that extend past latest end
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

    const { error: updateError } = await supabase
      .from('trips')
      .update({
        itinerary_data: { ...itineraryData, days } as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (updateError) {
      console.error('[FlightPatch] Failed to update itinerary:', updateError);
      return false;
    }

    console.log('[FlightPatch] Patched Day 1/last day with flight times');
    return true;
  } catch (err) {
    console.error('[FlightPatch] Error:', err);
    return false;
  }
}
