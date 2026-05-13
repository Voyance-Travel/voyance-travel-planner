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
 *
 * Parity invariants (see mem://constraints/itinerary/health-cascade-preview):
 *  1. Lock detection delegates to canonical `isActivityLocked` so manuallyAdded
 *     / extracted / pinned / lockState rows are all honored — same set the
 *     chat executor + save-time cascade respect.
 *  2. Missing `endTime` is synthesized from `startTime + durationMinutes` on
 *     the clone so the cascade's overlap/buffer branches engage instead of
 *     silently bailing.
 *  3. `title` falls back to `name` so the engine's structural classifier
 *     gets a usable label.
 */
import {
  enforceTimingAndBuffers,
  parseTime,
  type CascadeActivity,
} from '@/utils/itinerary/timingCascade';
import { isActivityLocked } from '@/lib/itinerary/persistDayContract';

export type CascadePreviewMap = Map<string, { startTime?: string; endTime?: string }>;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function minutesToTimeLocal(m: number): string {
  const mod = ((m % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(mod / 60))}:${pad2(mod % 60)}`;
}

export function buildCascadePreview(
  activities: any[],
  lockedIds?: Set<string>
): CascadePreviewMap {
  const out: CascadePreviewMap = new Map();
  if (!Array.isArray(activities) || activities.length < 2) return out;

  // Clone deeply enough that the cascade can't mutate caller state. Synthesize
  // missing endTime from start + duration so the overlap/buffer branches in
  // `enforceTimingAndBuffers` engage. Also surface `name` as `title` so
  // structural classification works on records that only carry `name`.
  const clone: CascadeActivity[] = activities.map((a) => {
    // Parser canonicalizes legacy `time` → `startTime`. Don't re-introduce
    // `time` as a fallback here; an activity reaching this point without
    // `startTime` is genuinely untimed and should remain so.
    // mem://constraints/itinerary/time-field-canonicalization
    const startTime = a?.startTime ?? a?.start_time;
    let endTime = a?.endTime ?? a?.end_time;
    if (!endTime && typeof startTime === 'string') {
      const startMins = parseTime(startTime);
      const dur =
        typeof a?.durationMinutes === 'number'
          ? a.durationMinutes
          : typeof a?.duration === 'number'
            ? a.duration
            : null;
      if (startMins !== null && typeof dur === 'number' && dur > 0) {
        endTime = minutesToTimeLocal(startMins + dur);
      }
    }
    return {
      ...a,
      title: a?.title || a?.name,
      startTime,
      endTime,
      location: a?.location ? { ...a.location } : a?.location,
    };
  });

  const locked =
    lockedIds ??
    new Set<string>(
      activities
        .filter((a) => isActivityLocked(a))
        .map((a) => String(a?.id))
        .filter((id) => id && id !== 'undefined')
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
