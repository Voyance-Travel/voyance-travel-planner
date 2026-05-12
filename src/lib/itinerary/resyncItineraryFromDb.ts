/**
 * Single source of truth: re-read the canonical itinerary_data from DB and
 * hand it to whoever owns trip session state. Save callers fire the event;
 * TripDetail listens and applies the fresh DB read.
 *
 * See mem://constraints/itinerary/db-is-source-of-truth.
 */

import { supabase } from '@/integrations/supabase/client';

export const TRIP_PERSISTED_EVENT = 'trip-itinerary-persisted';

export interface TripPersistedDetail {
  tripId: string;
  /** Optional pre-save day snapshot for drift telemetry. */
  prevDays?: unknown[];
  /** Optional source label (handleGenerationComplete, EditorialItinerary.save, ActionExecutor, …). */
  source?: string;
}

/** Fire-and-forget: signal that a persist completed so listeners can resync. */
export function dispatchTripPersisted(detail: TripPersistedDetail): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(TRIP_PERSISTED_EVENT, { detail }));
  } catch (err) {
    // Non-fatal — telemetry only.
    console.warn('[resyncItineraryFromDb] dispatch failed:', err);
  }
}

export interface ResyncResult {
  itineraryData: Record<string, unknown> | null;
  startDate: string | null;
  endDate: string | null;
  itineraryStatus: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Read the canonical itinerary_data row. Lightweight — single SELECT, no parser.
 * Caller decides how to feed it into local state.
 */
export async function resyncItineraryFromDb(tripId: string): Promise<ResyncResult | null> {
  if (!tripId) return null;
  const { data, error } = await supabase
    .from('trips')
    .select('itinerary_data, start_date, end_date, itinerary_status, metadata')
    .eq('id', tripId)
    .maybeSingle();
  if (error) {
    console.warn('[resyncItineraryFromDb] read failed:', error);
    return null;
  }
  if (!data) return null;
  return {
    itineraryData: (data.itinerary_data as Record<string, unknown> | null) ?? null,
    startDate: (data.start_date as string | null) ?? null,
    endDate: (data.end_date as string | null) ?? null,
    itineraryStatus: (data.itinerary_status as string | null) ?? null,
    metadata: (data.metadata as Record<string, unknown> | null) ?? null,
  };
}

// ---- Drift telemetry ------------------------------------------------------

interface DaySummary {
  dayNumber: number;
  meaningfulCount: number;
  terminalEnd: string | null;
  hasHotelReturn: boolean;
}

const HOTEL_RETURN_RE = /return\s+to\s+(your\s+)?hotel|back\s+to\s+(the\s+)?hotel/i;
const NON_MEANINGFUL_CATEGORIES = new Set(['transport', 'transit', 'transfer', 'logistics']);

function summarizeDay(day: any): DaySummary {
  const acts = Array.isArray(day?.activities) ? day.activities : [];
  let meaningful = 0;
  let terminalEnd: string | null = null;
  let hasReturn = false;
  for (const a of acts) {
    const cat = String(a?.category || a?.type || '').toLowerCase();
    const title = String(a?.title || a?.name || '');
    if (!NON_MEANINGFUL_CATEGORIES.has(cat)) meaningful++;
    if (HOTEL_RETURN_RE.test(title)) hasReturn = true;
    const end = a?.endTime || a?.end_time;
    if (typeof end === 'string' && end) terminalEnd = end;
  }
  return {
    dayNumber: Number(day?.dayNumber ?? day?.day_number ?? 0),
    meaningfulCount: meaningful,
    terminalEnd,
    hasHotelReturn: hasReturn,
  };
}

/**
 * Compare pre-save days vs DB days; emit a single structured warn per drifted day.
 * Pure telemetry — never throws, never blocks.
 */
export function reportItineraryDrift(
  tripId: string,
  prevDays: unknown[] | undefined,
  dbDays: unknown[] | undefined,
  source?: string,
): void {
  if (!Array.isArray(prevDays) || !Array.isArray(dbDays)) return;
  try {
    const prevByNum = new Map<number, DaySummary>();
    for (const d of prevDays) {
      const s = summarizeDay(d);
      if (s.dayNumber > 0) prevByNum.set(s.dayNumber, s);
    }
    for (const d of dbDays) {
      const cur = summarizeDay(d);
      if (cur.dayNumber <= 0) continue;
      const prev = prevByNum.get(cur.dayNumber);
      if (!prev) continue;
      const kinds: string[] = [];
      if (prev.meaningfulCount !== cur.meaningfulCount) kinds.push('meaningful_count');
      if (prev.terminalEnd !== cur.terminalEnd) kinds.push('terminal_end');
      if (prev.hasHotelReturn !== cur.hasHotelReturn) kinds.push('hotel_return');
      if (kinds.length > 0) {
        console.warn('[ITIN_RESYNC_DRIFT]', {
          tripId,
          source: source || 'unknown',
          day: cur.dayNumber,
          kinds,
          prev: { meaningful: prev.meaningfulCount, terminalEnd: prev.terminalEnd, hotelReturn: prev.hasHotelReturn },
          db:   { meaningful: cur.meaningfulCount,  terminalEnd: cur.terminalEnd,  hotelReturn: cur.hasHotelReturn  },
        });
      }
    }
  } catch (err) {
    // Telemetry must never break callers.
    console.warn('[reportItineraryDrift] failed:', err);
  }
}
