/**
 * timingCascade — client-side mirror of supabase/functions/_shared/timing-cascade.ts.
 *
 * Pure TS, no Deno deps. Catches:
 *   1. same-start collisions
 *   2. plain overlaps
 *   3. insufficient-buffer transitions between distinct-coordinate cards
 *   4. transit cards whose start sits inside the previous activity (always pull them forward)
 *
 * Mirrors the server algorithm so client-side auto-repair and the pre-save server pass agree.
 */

export interface CascadeActivity {
  id: string;
  title?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  location?: { lat?: number; lng?: number; address?: string; name?: string };
  [k: string]: unknown;
}

export interface CascadeRepair {
  type: 'same_start_fix' | 'overlap_fix' | 'buffer_fix' | 'transit_pull_fix' | 'dropped_past_midnight';
  activityId: string;
  activityTitle?: string;
  before?: string;
  after?: string;
  message: string;
}

export interface CascadeOptions {
  lockedIds?: Set<string>;
  cutoffMinutes?: number;
  overlapBufferMinutes?: number;
}

export interface CascadeResult<T extends CascadeActivity> {
  activities: T[];
  repairs: CascadeRepair[];
  droppedIds: string[];
}

export function parseTime(t: string | undefined | null): number | null {
  if (!t) return null;
  const m = String(t).trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

interface TransitEstimate {
  durationMinutes: number;
  method: string;
  distance: string;
}

function estimateTransit(a: CascadeActivity, b: CascadeActivity): TransitEstimate | null {
  if (a.location?.lat == null || b.location?.lat == null || a.location?.lng == null || b.location?.lng == null) return null;
  const distMeters = haversineMeters(
    { lat: a.location.lat, lng: a.location.lng },
    { lat: b.location.lat, lng: b.location.lng }
  );
  const walkMin = Math.ceil(distMeters / 80);
  const taxiMin = Math.max(3, Math.ceil(distMeters / 400));
  const isWalkable = walkMin <= 15;
  return {
    method: isWalkable ? 'walking' : distMeters < 10000 ? 'transit' : 'taxi',
    durationMinutes: isWalkable ? walkMin : distMeters < 10000 ? Math.max(5, Math.ceil(distMeters / 500) + 5) : taxiMin,
    distance: distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(1)}km`,
  };
}

const TRANSIT_CATS = ['transportation', 'transit', 'transfer', 'taxi', 'transport', 'commute', 'travel'];
const ACCOMMODATION_CATS = ['accommodation', 'hotel', 'lodging'];

function isTransit(a: CascadeActivity): boolean {
  const c = (a.category || '').toLowerCase();
  return TRANSIT_CATS.some(t => c.includes(t));
}

function isSamePlace(a: CascadeActivity, b: CascadeActivity): boolean {
  if (a.location?.lat != null && b.location?.lat != null && a.location?.lng != null && b.location?.lng != null) {
    const dist = haversineMeters(
      { lat: a.location.lat, lng: a.location.lng },
      { lat: b.location.lat, lng: b.location.lng }
    );
    return dist < 100;
  }
  const aName = (a.location?.name || a.location?.address || '').toLowerCase().trim();
  const bName = (b.location?.name || b.location?.address || '').toLowerCase().trim();
  if (aName && bName && aName === bName) return true;
  if (!a.location && !b.location) return true;
  return false;
}

function getMinBufferMinutes(fromCat?: string, toCat?: string): number {
  const fromLower = fromCat?.toLowerCase() || '';
  const toLower = toCat?.toLowerCase() || '';
  if (TRANSIT_CATS.some(t => fromLower.includes(t)) || TRANSIT_CATS.some(t => toLower.includes(t))) return 0;
  if (ACCOMMODATION_CATS.some(t => fromLower.includes(t)) || ACCOMMODATION_CATS.some(t => toLower.includes(t))) return 5;
  return 15;
}

function getEffectiveMinBuffer(from: CascadeActivity, to: CascadeActivity): number {
  const catBuffer = getMinBufferMinutes(from.category, to.category);
  if (catBuffer === 0 && !isSamePlace(from, to)) return 5;
  return catBuffer;
}

const STRUCTURAL_CATS = new Set(['accommodation', 'hotel', 'stay']);
const STRUCTURAL_KW = ['checkout', 'check-out', 'check out', 'departure flight', 'flight departure', 'airport security'];

function isStructural(act: CascadeActivity, lockedIds: Set<string>): boolean {
  if (lockedIds.has(act.id)) return true;
  const cat = (act.category || '').toLowerCase();
  const title = (act.title || '').toLowerCase();
  if (STRUCTURAL_CATS.has(cat)) return true;
  return STRUCTURAL_KW.some(kw => title.includes(kw));
}

function isEndOfDayBookend(act: CascadeActivity): boolean {
  const cat = (act.category || '').toLowerCase();
  const title = (act.title || '').toLowerCase();
  if (cat === 'accommodation' && (title.includes('return to') || title.includes('freshen up') || title.includes('check-in') || title.includes('check in'))) return true;
  if ((cat === 'transport' || cat === 'transportation') && (title.includes('hotel') || ((act.location?.name || '') as string).toLowerCase().includes('hotel'))) return true;
  return false;
}

export function enforceTimingAndBuffers<T extends CascadeActivity>(
  input: T[],
  opts: CascadeOptions = {}
): CascadeResult<T> {
  const lockedIds = opts.lockedIds ?? new Set<string>();
  const cutoff = opts.cutoffMinutes ?? (23 * 60 + 30);
  const overlapBuffer = opts.overlapBufferMinutes ?? 5;
  const repairs: CascadeRepair[] = [];

  let activities = [...input].sort((a, b) => {
    const ta = parseTime(a.startTime) ?? 99999;
    const tb = parseTime(b.startTime) ?? 99999;
    return ta - tb;
  });

  const cascadeShift = (fromIdx: number, delta: number) => {
    if (delta <= 0) return;
    for (let j = fromIdx; j < activities.length; j++) {
      if (lockedIds.has(activities[j].id)) continue;
      const s = parseTime(activities[j].startTime);
      const e = parseTime(activities[j].endTime);
      if (s !== null) activities[j].startTime = minutesToTime(s + delta);
      if (e !== null) activities[j].endTime = minutesToTime(e + delta);
    }
  };

  for (let i = 0; i < activities.length - 1; i++) {
    const curr = activities[i];
    const next = activities[i + 1];
    if (lockedIds.has(next.id)) continue;

    const currStart = parseTime(curr.startTime);
    const currEnd = parseTime(curr.endTime);
    const nextStart = parseTime(next.startTime);
    if (currStart === null || nextStart === null) continue;

    if (currStart === nextStart && !isStructural(next, lockedIds)) {
      const anchorEnd = currEnd ?? (currStart + ((curr.durationMinutes as number) || 30));
      const target = anchorEnd + overlapBuffer;
      const delta = target - nextStart;
      if (delta > 0) {
        const before = `${next.title} @ ${next.startTime}`;
        cascadeShift(i + 1, delta);
        repairs.push({
          type: 'same_start_fix',
          activityId: next.id,
          activityTitle: next.title,
          before,
          after: `${next.title} @ ${next.startTime}`,
          message: `"${curr.title}" and "${next.title}" both started at ${minutesToTime(currStart)} — pushed "${next.title}" forward.`,
        });
      }
      continue;
    }

    if (currEnd !== null && currEnd > nextStart && !isStructural(next, lockedIds)) {
      // Transit cards: zero buffer is fine, but they must not start before currEnd.
      const buffer = isTransit(next) || isTransit(curr) ? 0 : overlapBuffer;
      const target = currEnd + buffer;
      const delta = target - nextStart;
      if (delta > 0) {
        const before = `${next.title} @ ${next.startTime}`;
        cascadeShift(i + 1, delta);
        repairs.push({
          type: isTransit(next) ? 'transit_pull_fix' : 'overlap_fix',
          activityId: next.id,
          activityTitle: next.title,
          before,
          after: `${next.title} @ ${next.startTime}`,
          message: `"${curr.title}" ended at ${minutesToTime(currEnd)} but "${next.title}" started at ${minutesToTime(nextStart)} — pushed forward.`,
        });
      }
      continue;
    }

    if (currEnd !== null && !isStructural(next, lockedIds)) {
      const refreshedNextStart = parseTime(next.startTime)!;
      const gap = refreshedNextStart - currEnd;
      if (gap >= 0) {
        const transit = estimateTransit(curr, next);
        const minBuffer = getEffectiveMinBuffer(curr, next);
        const required = (transit?.durationMinutes ?? 0) + minBuffer;
        if (required > 0 && gap < required) {
          const delta = required - gap;
          const before = `${next.title} @ ${next.startTime}`;
          cascadeShift(i + 1, delta);
          repairs.push({
            type: 'buffer_fix',
            activityId: next.id,
            activityTitle: next.title,
            before,
            after: `${next.title} @ ${next.startTime}`,
            message: `Tight transition between "${curr.title}" and "${next.title}" — added ${delta} min.`,
          });
        }
      }
    }
  }

  const droppedIds: string[] = [];
  activities = activities.filter((act) => {
    const s = parseTime(act.startTime);
    if (s !== null && s > cutoff && !lockedIds.has(act.id) && !isEndOfDayBookend(act)) {
      droppedIds.push(act.id);
      repairs.push({
        type: 'dropped_past_midnight',
        activityId: act.id,
        activityTitle: act.title,
        before: `${act.title} @ ${act.startTime}`,
        message: `"${act.title}" pushed past ${minutesToTime(cutoff)} — dropped.`,
      });
      return false;
    }
    return true;
  });

  return { activities, repairs, droppedIds };
}
