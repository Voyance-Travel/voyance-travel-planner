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
 *  4. Round 3 — every clone gets a synthetic id (`idx:N`) when the source
 *     activity lacks one or its id collides with a sibling. The map is keyed
 *     by both the original id (when present) AND `idx:N` so id-less /
 *     duplicate-id rows still resolve to their post-cascade times.
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

export function indexKey(idx: number): string {
  return `idx:${idx}`;
}

export function buildCascadePreview(
  activities: any[],
  lockedIds?: Set<string>
): CascadePreviewMap {
  const out: CascadePreviewMap = new Map();
  if (!Array.isArray(activities) || activities.length < 2) return out;

  // Track sibling id collisions so we don't let one activity silently
  // overwrite another's preview entry. Any id seen >1 time is downgraded to
  // the synthetic `idx:N` key only.
  const idCounts = new Map<string, number>();
  for (const a of activities) {
    const raw = a?.id;
    if (raw === undefined || raw === null || raw === '') continue;
    const k = String(raw);
    idCounts.set(k, (idCounts.get(k) || 0) + 1);
  }

  // Clone deeply enough that the cascade can't mutate caller state. Synthesize
  // missing endTime from start + duration so the overlap/buffer branches in
  // `enforceTimingAndBuffers` engage. Also surface `name` as `title` so
  // structural classification works on records that only carry `name`.
  // Each clone gets a stable `__previewKey` (its source index) so the cascade
  // result can always be located even when ids are missing or collide.
  const clone: (CascadeActivity & { __previewKey: string })[] = activities.map((a, idx) => {
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
    const previewKey = indexKey(idx);
    // The cascade engine requires `id` for lock-set checks. If the source row
    // has no id, give the clone the synthetic key as its id so the engine
    // doesn't choke. Locked-set membership for id-less rows is already false.
    const cascadeId = (a?.id !== undefined && a?.id !== null && a?.id !== '')
      ? String(a.id)
      : previewKey;
    return {
      ...a,
      id: cascadeId,
      title: a?.title || a?.name,
      startTime,
      endTime,
      location: a?.location ? { ...a.location } : a?.location,
      __previewKey: previewKey,
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
    const previewKey = (a as any)?.__previewKey as string | undefined;
    const value = {
      startTime: typeof a.startTime === 'string' ? a.startTime : undefined,
      endTime: typeof a.endTime === 'string' ? a.endTime : undefined,
    };
    if (previewKey) out.set(previewKey, value);

    const id = a?.id;
    if (id !== undefined && id !== null && id !== '') {
      const sid = String(id);
      // Don't let a colliding id overwrite an earlier sibling's preview.
      // Both rows can still be resolved via their `idx:N` keys.
      if ((idCounts.get(sid) || 0) <= 1 && sid !== previewKey) {
        out.set(sid, value);
      }
    }
  }
  return out;
}
