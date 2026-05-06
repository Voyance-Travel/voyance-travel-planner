/**
 * fixDayTiming — deterministic auto-spacing for day activities with overlapping
 * or too-close timings. Pure function, no AI calls.
 *
 * Strategy:
 *  - Sort activities by startTime.
 *  - Walk forward; when activity[i].endTime > activity[i+1].startTime, push
 *    activity[i+1] forward to start at activity[i].endTime + buffer.
 *  - Buffer = 5 min, except 0 min when either side is transit/transfer/walking.
 *  - Preserve each activity's duration. Locked/pinned activities are immovable
 *    anchors — only the movable neighbour shifts.
 *  - If pushing past 23:30 cap, abort with day_overflow so the caller can
 *    fall back to the AI Refresh Day flow.
 */

export interface TimedActivity {
  id?: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  category?: string | null;
  type?: string | null;
  locked?: boolean;
  pinned?: boolean;
  isLocked?: boolean;
  // any other fields are passed through unchanged
  [key: string]: any;
}

export interface FixDayTimingResult<T extends TimedActivity> {
  success: boolean;
  reason?: 'no_changes' | 'day_overflow' | 'no_timed_activities';
  resolvedCount: number;
  activities: T[];
}

const DAY_END_CAP_MINUTES = 23 * 60 + 30; // 23:30
const DEFAULT_BUFFER_MIN = 5;
const TRANSIT_CATS = new Set([
  'transit', 'transport', 'transportation', 'transfer', 'walking', 'taxi', 'rideshare', 'metro',
]);

function parseHHMM(t?: string | null): number | null {
  if (!t || typeof t !== 'string') return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

function fmtHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isTransit(a: TimedActivity): boolean {
  const c = (a.category || a.type || '').toLowerCase();
  return TRANSIT_CATS.has(c);
}

function isLocked(a: TimedActivity): boolean {
  return Boolean(a.locked || a.pinned || a.isLocked);
}

export function fixDayTiming<T extends TimedActivity>(input: T[]): FixDayTimingResult<T> {
  if (!Array.isArray(input) || input.length === 0) {
    return { success: false, reason: 'no_timed_activities', resolvedCount: 0, activities: input || [] };
  }

  // Index timed activities + remember original index
  const items = input.map((a, idx) => {
    const startRaw = a.startTime ?? (a as any).time ?? (a as any).start_time;
    const endRaw = a.endTime ?? (a as any).end_time;
    const start = parseHHMM(startRaw);
    let end = parseHHMM(endRaw);
    const durRaw =
      typeof a.durationMinutes === 'number'
        ? a.durationMinutes
        : typeof (a as any).duration_minutes === 'number'
        ? (a as any).duration_minutes
        : typeof (a as any).duration === 'number'
        ? (a as any).duration
        : null;
    // Derive end from start + duration if missing
    if (end == null && start != null && typeof durRaw === 'number' && durRaw > 0) {
      end = start + durRaw;
    }
    const duration =
      typeof durRaw === 'number' && durRaw > 0
        ? durRaw
        : start != null && end != null && end > start
        ? end - start
        : null;
    return { idx, start, end, duration, locked: isLocked(a), transit: isTransit(a), raw: a };
  });

  const timed = items
    .filter(x => x.start != null && x.end != null)
    .sort((a, b) => (a.start! - b.start!));

  if (timed.length < 2) {
    return { success: false, reason: 'no_timed_activities', resolvedCount: 0, activities: input };
  }

  let resolved = 0;
  for (let i = 0; i < timed.length - 1; i++) {
    const cur = timed[i];
    const next = timed[i + 1];
    if (cur.end == null || next.start == null) continue;

    // Only act when there is an overlap or sub-buffer gap.
    const gap = next.start - cur.end;
    const needsBuffer = !(cur.transit || next.transit);
    const minGap = needsBuffer ? DEFAULT_BUFFER_MIN : 0;
    if (gap >= minGap) continue;

    if (next.locked) {
      // Can't move locked next; try to pull cur back (shorten? no — leave it).
      // Skip; this conflict cannot be auto-resolved without changing duration.
      continue;
    }

    const newStart = cur.end + minGap;
    const dur = next.duration ?? Math.max(30, (next.end ?? newStart + 30) - next.start);
    const newEnd = newStart + dur;
    if (newEnd > DAY_END_CAP_MINUTES) {
      return {
        success: false,
        reason: 'day_overflow',
        resolvedCount: resolved,
        activities: input,
      };
    }
    next.start = newStart;
    next.end = newEnd;
    resolved += 1;
  }

  if (resolved === 0) {
    return { success: false, reason: 'no_changes', resolvedCount: 0, activities: input };
  }

  // Build patched output, preserving original order in the input array.
  const patchById = new Map<number, { startTime: string; endTime: string }>();
  for (const t of timed) {
    if (t.start == null || t.end == null) continue;
    patchById.set(t.idx, { startTime: fmtHHMM(t.start), endTime: fmtHHMM(t.end) });
  }
  const out = input.map((a, idx) => {
    const p = patchById.get(idx);
    if (!p) return a;
    if (a.startTime === p.startTime && a.endTime === p.endTime) return a;
    return { ...a, startTime: p.startTime, endTime: p.endTime };
  });

  return { success: true, resolvedCount: resolved, activities: out };
}
