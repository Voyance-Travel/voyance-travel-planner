/**
 * trip-total-days — single source of truth for "how many days is this trip?".
 *
 * Closes the Bangkok-class failure where `itinerary_data.days.length` was
 * the de-facto answer in multiple call sites, so a JSON write that shrank
 * `days` to 1 silently rewrote the trip's duration everywhere (header chip,
 * hotel-nights label, departure-day classifier, bookend injector).
 *
 * Rule: trust the most generous truthful signal, in this order:
 *   1. trip.end_date − trip.start_date + 1   (canonical contract)
 *   2. itinerary_days table row count        (DB-of-record for generation)
 *   3. metadata.generation_total_days        (stamped at generation start)
 *   4. itinerary_data.days.length            (legacy render artifact)
 *
 * Any value <= 0 from a source is ignored. Returns max(...) >= 1.
 *
 * See mem://constraints/itinerary/no-regression-overwrite +
 *     mem://constraints/itinerary/db-is-source-of-truth.
 */

export interface TripDateLike {
  start_date?: string | null;
  end_date?: string | null;
}

export function dateSpanDays(trip: TripDateLike | null | undefined): number {
  if (!trip?.start_date || !trip?.end_date) return 0;
  const a = new Date(trip.start_date).getTime();
  const b = new Date(trip.end_date).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.floor((b - a) / (1000 * 60 * 60 * 24)) + 1;
}

export interface TotalDaysSources {
  trip?: TripDateLike | null;
  itineraryDaysTableCount?: number | null;
  generationTotalDays?: number | null;
  jsonDaysLength?: number | null;
}

export function totalDays(sources: TotalDaysSources): number {
  const candidates = [
    dateSpanDays(sources.trip || null),
    Number(sources.itineraryDaysTableCount || 0),
    Number(sources.generationTotalDays || 0),
    Number(sources.jsonDaysLength || 0),
  ].map((n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0));
  return Math.max(1, ...candidates);
}

/**
 * Async helper for the persist boundary: probes the supabase client for the
 * date span + table row count + metadata.generation_total_days. Returns the
 * canonical total, or `Math.max(1, jsonDaysLength)` on any probe failure
 * (non-blocking — never fails the write).
 */
export async function resolveTripTotalDays(
  supabase: any,
  tripId: string,
  jsonDaysLength: number,
): Promise<{ total: number; sources: Required<Omit<TotalDaysSources, 'trip'>> & { dateSpan: number } }> {
  let dateSpan = 0;
  let tableCount = 0;
  let generationTotalDays = 0;
  try {
    const { data: trip } = await supabase
      .from('trips')
      .select('start_date, end_date, metadata')
      .eq('id', tripId)
      .maybeSingle();
    if (trip) {
      dateSpan = dateSpanDays({ start_date: trip.start_date, end_date: trip.end_date });
      const meta = (trip.metadata as Record<string, any>) || {};
      const g = Number(meta.generation_total_days || 0);
      if (Number.isFinite(g) && g > 0) generationTotalDays = Math.floor(g);
    }
  } catch (_e) { /* non-blocking */ }
  try {
    const { count } = await supabase
      .from('itinerary_days')
      .select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId);
    if (Number.isFinite(count) && (count as number) > 0) tableCount = count as number;
  } catch (_e) { /* non-blocking */ }
  const total = Math.max(
    1,
    dateSpan,
    tableCount,
    generationTotalDays,
    Math.max(0, Math.floor(jsonDaysLength || 0)),
  );
  return {
    total,
    sources: {
      dateSpan,
      itineraryDaysTableCount: tableCount,
      generationTotalDays,
      jsonDaysLength: Math.max(0, Math.floor(jsonDaysLength || 0)),
    },
  };
}
