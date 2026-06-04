/**
 * Final-day completeness gate — the closing guarantee of the v2 chain.
 *
 * ROOT-CAUSE NOTE ("Day N shipped empty → Partial badge despite 'ready'"):
 * The v2 chain persists each day in TWO layers — the `itinerary_activities`
 * TABLE (persistDay, step 7, pre-JSON-merge) and the `trips.itinerary_data`
 * JSON (persistTripItinerary, step 9). These can DIVERGE: a day's table rows
 * commit, but its JSON merge write is lost or blocked (persistTripItinerary
 * only `console.warn`s on failure) — so the day survives in the table with a
 * title but lands in the JSON with `activities: []`. Worse, every per-day
 * coverage gate (6c meal guard, 8g final meal gate) bails on an empty day with
 * `if (!acts) continue`, so nothing re-fills it. The day then ships empty, the
 * trip flips to "ready", and the Trip Health panel demotes to "Partial".
 *
 * Before the heartbeat fix (#16) this surfaced as a (false-ish) "Generation
 * paused at Day N" — a crude completeness signal. Removing the false-pauses
 * means we now need a REAL one. This module is it: on the last day, verify
 * every day 1..N has non-empty activities in the merged JSON and HEAL any that
 * don't — first from the authoritative table (zero LLM cost, recovers the
 * divergence case fully), then (caller-supplied) regeneration for a genuine
 * total miss, then a meal-coverage floor so a day is NEVER literally empty.
 *
 * This file holds the PURE, unit-testable pieces. The supabase reads and the
 * regen recursion are orchestrated by the caller (generate-trip-day-v2.ts),
 * which threads them in.
 */

/** A day is "complete" iff it has a non-empty activities array. */
export function isDayComplete(day: any): boolean {
  return !!day && Array.isArray(day.activities) && day.activities.length > 0;
}

/**
 * Day numbers (1..totalDays) that are missing from `mergedDays` or present but
 * with empty/absent activities — i.e. the days that need healing.
 */
export function findEmptyDays(mergedDays: any[], totalDays: number): number[] {
  const byNum = new Map<number, any>();
  if (Array.isArray(mergedDays)) {
    for (const d of mergedDays) {
      const n = d?.dayNumber ?? d?.day_number;
      if (typeof n === 'number') byNum.set(n, d);
    }
  }
  const out: number[] = [];
  for (let n = 1; n <= totalDays; n++) {
    if (!isDayComplete(byNum.get(n))) out.push(n);
  }
  return out;
}

/**
 * Map a persisted `itinerary_activities` row (snake_case) back to the in-memory
 * JSON activity shape (camelCase). Inverse of persist-day.ts:makeActivityRow.
 * Unknown/null columns are simply omitted/passed through.
 */
export function mapTableRowToActivity(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const a: any = {
    id: row.id,
    title: row.title || row.name || 'Activity',
    name: row.name || row.title,
    description: row.description ?? undefined,
    category: row.category || 'activity',
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined,
    location: row.location ?? undefined,
    cost: row.cost ?? undefined,
    tags: row.tags ?? undefined,
    isLocked: !!row.is_locked,
    bookingRequired: !!row.booking_required,
    tips: row.tips ?? undefined,
    photos: row.photos ?? undefined,
    walkingDistance: row.walking_distance ?? undefined,
    walkingTime: row.walking_time ?? undefined,
    transportation: row.transportation ?? undefined,
    rating: row.rating ?? undefined,
    website: row.website ?? undefined,
    viatorProductCode: row.viator_product_code ?? undefined,
  };
  if (row.external_id) a.external_id = row.external_id;
  // Drop undefined keys so the object stays clean for downstream passes.
  for (const k of Object.keys(a)) if (a[k] === undefined) delete a[k];
  return a;
}

/** Map a full set of table rows (already ordered by sort_order) to activities. */
export function mapTableRowsToActivities(rows: any[]): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(mapTableRowToActivity);
}

/**
 * Splice a healed day's activities into `mergedDays` in place. If the day
 * object exists, its activities are replaced; otherwise a minimal day object is
 * inserted and the array re-sorted by dayNumber. Returns the (possibly new)
 * mergedDays reference for chaining.
 */
export function applyHealedDay(
  mergedDays: any[],
  dayNumber: number,
  activities: any[],
  dateForNewDay?: string | null,
): any[] {
  const idx = mergedDays.findIndex(
    (d: any) => (d?.dayNumber ?? d?.day_number) === dayNumber,
  );
  if (idx >= 0) {
    mergedDays[idx].activities = activities;
  } else {
    mergedDays.push({ dayNumber, date: dateForNewDay ?? null, activities });
    mergedDays.sort(
      (a: any, b: any) =>
        (a?.dayNumber ?? a?.day_number ?? 0) - (b?.dayNumber ?? b?.day_number ?? 0),
    );
  }
  return mergedDays;
}
