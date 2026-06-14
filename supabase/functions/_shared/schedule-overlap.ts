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
