/**
 * reconcile-failed-days — drop stale day-numbers from
 * `trips.metadata.failed_day_numbers` once the corresponding day actually
 * has saved activities in `itinerary_activities`.
 *
 * Bangkok pattern: trip metadata reported `failed_day_numbers=[3,4]` but
 * the tables showed Days 3+4 had 11+3 activities respectively. The stale
 * list pinned the UI in "incomplete generation" mode and forced the next
 * page-load self-heal to attempt regeneration on healthy days.
 *
 * Rule: any day with >= MIN_ACTIVITIES rows in `itinerary_activities`
 * (default 3) is considered populated; reconciler removes it from the
 * failed list. Call from persist-itinerary at the end of every successful
 * write, and from page-load self-heal paths.
 *
 * Sentinel: `[FAILED_DAYS_RECONCILED] before=[...] after=[...]`.
 *
 * Non-blocking: any DB error logs a warning and returns without mutating.
 */

const MIN_ACTIVITIES_TO_CLEAR = 3;

export async function reconcileFailedDays(
  supabase: any,
  tripId: string,
  opts: { label?: string; minActivities?: number } = {},
): Promise<{ before: number[]; after: number[]; cleared: number[] } | null> {
  const label = opts.label || 'reconcile-failed-days';
  const min = opts.minActivities ?? MIN_ACTIVITIES_TO_CLEAR;
  try {
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('metadata')
      .eq('id', tripId)
      .maybeSingle();
    if (tripErr || !trip) return null;
    const meta = (trip.metadata as Record<string, any>) || {};
    const before: number[] = Array.isArray(meta.failed_day_numbers)
      ? (meta.failed_day_numbers as number[]).filter((n) => Number.isFinite(n))
      : [];
    if (before.length === 0) return { before, after: before, cleared: [] };

    const { data: rows, error: actErr } = await supabase
      .from('itinerary_activities')
      .select('day_number')
      .eq('trip_id', tripId);
    if (actErr) {
      console.warn(`[${label}] activities probe failed (non-blocking):`, actErr);
      return null;
    }
    const counts = new Map<number, number>();
    for (const r of (rows || []) as { day_number: number }[]) {
      const d = Number(r.day_number);
      if (!Number.isFinite(d)) continue;
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    const cleared: number[] = [];
    const after = before.filter((d) => {
      const populated = (counts.get(d) || 0) >= min;
      if (populated) cleared.push(d);
      return !populated;
    });
    if (cleared.length === 0) {
      return { before, after, cleared };
    }
    const nextMeta = { ...meta, failed_day_numbers: after };
    const { error: upErr } = await supabase
      .from('trips')
      .update({ metadata: nextMeta })
      .eq('id', tripId);
    if (upErr) {
      console.warn(`[${label}] update failed (non-blocking):`, upErr);
      return { before, after: before, cleared: [] };
    }
    console.log(
      `[${label}] [FAILED_DAYS_RECONCILED] before=[${before.join(',')}] after=[${after.join(',')}] cleared=[${cleared.join(',')}]`,
    );
    return { before, after, cleared };
  } catch (e) {
    console.warn(`[${label}] probe failed (non-blocking):`, e);
    return null;
  }
}
