/**
 * Frontend mirror of `_shared/timing-cascade.ts::dayChronoKey`.
 *
 * Wrap-aware sort key for ordering activities WITHIN a single day. Times in
 * the early-AM wrap window (default `[00:00, 06:00)`) belong to the END of
 * the parent day — e.g. a 23:30 nightcap followed by a 00:55 hotel-return
 * bookend. Without this, raw `mins-since-midnight` sorts re-order the
 * bookend to the TOP of the day at "12:55 AM".
 *
 * Returns `Number.MAX_SAFE_INTEGER` for unparseable / empty inputs so untimed
 * rows always sort to the end.
 *
 * Memory: mem://constraints/itinerary/read-time-hotel-return-bookend
 */
export function dayChronoKey(
  startTime: unknown,
  opts: { wrapBoundaryMin?: number } = {},
): number {
  const wrap = opts.wrapBoundaryMin ?? 6 * 60;
  if (typeof startTime !== 'string' || !startTime) return Number.MAX_SAFE_INTEGER;
  const m = startTime.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  const mins = h * 60 + min;
  return mins < wrap ? mins + 24 * 60 : mins;
}
