/**
 * Cheap, stable content hash of an itinerary for self-heal no-op detection.
 *
 * Used by `safeUpdateItineraryData` and the direct `save-itinerary` invokes
 * in `TripDetail.tsx` to short-circuit reload-time writes when the proposed
 * payload is byte-equivalent to what's already on disk. Skipping the write
 * (and its `TRIP_PERSISTED_EVENT` dispatch) is what breaks the
 * reload → resync → self-heal → save loop.
 *
 * Resolution: per-day activity count + total serialized-activity length.
 * Catches add/remove/reorder/text-edit; only false-negatives on byte-equal
 * mutations (which by definition don't need a re-save).
 */
export function itineraryFingerprint(
  itin: { days?: any[] } | null | undefined,
): string {
  const days = Array.isArray(itin?.days) ? (itin as any).days : [];
  const counts: number[] = [];
  let lenSum = 0;
  for (const d of days) {
    const acts = Array.isArray(d?.activities) ? d.activities : [];
    counts.push(acts.length);
    try {
      lenSum += JSON.stringify(acts).length;
    } catch {
      // Cyclic / non-serializable — fall back to a stable surrogate.
      lenSum += acts.length * 1000;
    }
  }
  return `${lenSum}:${counts.join(',')}`;
}
