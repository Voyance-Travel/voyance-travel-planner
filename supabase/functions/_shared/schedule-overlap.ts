/**
 * schedule-overlap — final, deterministic timeline-integrity guard. The model
 * (and post-hoc injections) can leave two activities double-booked
 * (e.g. dinner 20:20–22:20 overlapping a bar 21:45–23:15). This runs as the
 * absolute-last timing step before persist and guarantees no activity starts
 * before the previous one ends — pushing the later one just enough, preserving
 * its duration, never adding spurious buffer (so it doesn't fight transit
 * spacing). A genuinely over-packed day is clamped at end-of-day rather than
 * spilling past midnight; that surfaces as density, not as an impossible plan.
 */

const pm = (s: any): number | null => {
  const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};
const fm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const TRANSIT_RE = /\b(transit|transport|transfer|logistics|commute)\b/i;
const isTransitCard = (a: any): boolean =>
  TRANSIT_RE.test(String(a?.category ?? '')) ||
  /\b(taxi|transfer|drive|driving|travel (?:to|through|past)|head (?:to|toward)|en route|uber|lyft|train to|bus to|walk to)\b/i.test(String(a?.title ?? a?.name ?? ''));

/**
 * dropOrphanTransit — a "Travel to X" card with no real activity AFTER it (in
 * time order) is a dead end: the destination venue was dropped (e.g. by venue
 * grounding) leaving the traveler going nowhere. Remove any trailing run of
 * transit cards. Mutates + returns the array.
 */
export function dropOrphanTransit(activities: any[]): { activities: any[]; dropped: number } {
  if (!Array.isArray(activities) || activities.length === 0) return { activities: activities ?? [], dropped: 0 };
  const byTime = [...activities]
    .map((a, i) => ({ a, i, s: pm(a.startTime || a.time) }))
    .sort((x, y) => (x.s ?? 9999) - (y.s ?? 9999));
  const dropIdx = new Set<number>();
  // Walk from the end; drop trailing transit until we hit a real activity.
  for (let k = byTime.length - 1; k >= 0; k--) {
    if (isTransitCard(byTime[k].a)) dropIdx.add(byTime[k].i);
    else break;
  }
  if (dropIdx.size === 0) return { activities, dropped: 0 };
  return { activities: activities.filter((_, i) => !dropIdx.has(i)), dropped: dropIdx.size };
}

/**
 * snapEventCardsToPreferred — pull a curated host-city event card back toward its
 * intended slot. When the model's day is full at injection time, placeCardInGap
 * parks the card in a late fallback slot (a live World-Cup run put the Brewhouse
 * watch party at 23:15, after dinner). The relaxed-density cap then drops the
 * generic stops that crowded it — freeing the right slot — but the event card is
 * left stranded. Run this AFTER the cap: any host-city-event card whose start has
 * drifted more than `maxDriftMin` from its `preferredStart` is reset to that slot
 * (duration preserved). Re-run resolveScheduleOverlaps afterwards to tidy any
 * collision the move introduces. Mutates + returns the array.
 */
export function snapEventCardsToPreferred(
  activities: any[],
  opts: { maxDriftMin?: number } = {},
): { activities: any[]; moved: number } {
  if (!Array.isArray(activities) || activities.length === 0) return { activities: activities ?? [], moved: 0 };
  const maxDrift = opts.maxDriftMin ?? 120;
  let moved = 0;
  for (const a of activities) {
    if (a?.source !== 'host-city-event' || !a?.preferredStart) continue;
    const cur = pm(a.startTime || a.time);
    const pref = pm(a.preferredStart);
    if (cur == null || pref == null || Math.abs(cur - pref) <= maxDrift) continue;
    const dur = Math.max(60, (pm(a.endTime) ?? cur + 120) - cur);
    a.startTime = fm(pref);
    a.time = a.startTime;
    a.endTime = a.preferredEnd && pm(a.preferredEnd) != null ? a.preferredEnd : fm(pref + dur);
    moved++;
  }
  if (moved > 0) activities.sort((x, y) => ((pm(x.startTime || x.time) ?? 9999) - (pm(y.startTime || y.time) ?? 9999)));
  return { activities, moved };
}

/** Mutates + returns the activities array with all start/end overlaps removed. */
export function resolveScheduleOverlaps(
  activities: any[],
  opts: { dayEndMin?: number } = {},
): { activities: any[]; fixed: number } {
  if (!Array.isArray(activities) || activities.length < 2) {
    return { activities: activities ?? [], fixed: 0 };
  }
  const DAY_END = opts.dayEndMin ?? (23 * 60 + 59);
  // Work on the timed activities in chronological order; leave untimed as-is.
  const indexed = activities
    .map((a, i) => ({ a, i, s: pm(a.startTime || a.time), e: pm(a.endTime) }))
    .filter((x) => x.s != null) as Array<{ a: any; i: number; s: number; e: number | null }>;
  indexed.sort((x, y) => x.s - y.s);

  let fixed = 0;
  let prevEnd = -1;
  for (const cur of indexed) {
    const dur = Math.max(15, (cur.e ?? cur.s + 60) - cur.s);
    if (cur.s < prevEnd) {
      const newStart = Math.min(prevEnd, DAY_END - 15);
      // Prefer to keep the duration; if that spills past end-of-day, SHRINK it
      // (never clamp the start back into an overlap, never spill past midnight).
      const newDur = Math.max(15, Math.min(dur, DAY_END - newStart));
      cur.a.startTime = fm(newStart);
      cur.a.time = cur.a.startTime;
      cur.a.endTime = fm(newStart + newDur);
      cur.s = newStart;
      cur.e = newStart + newDur;
      fixed++;
    }
    prevEnd = cur.e ?? cur.s + dur;
  }
  return { activities, fixed };
}
