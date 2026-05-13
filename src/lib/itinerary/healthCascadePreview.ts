/**
 * healthCascadePreview — read-only dry-run of the buffered timing cascade.
 *
 * The save-time cascade (`enforceTimingAndBuffers`) auto-resolves overlaps and
 * tight buffers when the user saves. Until then, the source `startTime` /
 * `endTime` on the activity record sit at their pre-cascade values. The
 * health panel previously read those raw values and surfaced "10 min conflict"
 * warnings for collisions the scheduler will silently fix at next save.
 *
 * This helper runs the same cascade against a CLONE of the day's activities
 * and returns a lookup of post-cascade times keyed by activity id. Source
 * `days` are never mutated. Per
 * mem://constraints/itinerary/db-is-source-of-truth-on-load no FE on-mount
 * effect may persist these adjustments — analyzer-only.
 */
import {
  enforceTimingAndBuffers,
  type CascadeActivity,
} from '@/utils/itinerary/timingCascade';

export type CascadePreviewMap = Map<string, { startTime?: string; endTime?: string }>;

export function buildCascadePreview(
  activities: any[],
  lockedIds?: Set<string>
): CascadePreviewMap {
  const out: CascadePreviewMap = new Map();
  if (!Array.isArray(activities) || activities.length < 2) return out;

  // Clone deeply enough that the cascade can't mutate caller state.
  const clone: CascadeActivity[] = activities.map((a) => ({
    ...a,
    location: a?.location ? { ...a.location } : a?.location,
  }));

  const locked =
    lockedIds ??
    new Set<string>(
      activities
        .filter(
          (a) =>
            a?.locked === true ||
            a?.isLocked === true ||
            a?.lock_state === 'locked'
        )
        .map((a) => String(a.id))
    );

  let result;
  try {
    result = enforceTimingAndBuffers(clone, { lockedIds: locked });
  } catch {
    return out; // never break analyzer on cascade failure
  }

  for (const a of result.activities) {
    if (!a?.id) continue;
    out.set(String(a.id), {
      startTime: typeof a.startTime === 'string' ? a.startTime : undefined,
      endTime: typeof a.endTime === 'string' ? a.endTime : undefined,
    });
  }
  return out;
}
