/**
 * v2 Detector→Repair Upgrades (Phase C)
 *
 * Three deterministic post-enrich passes that land ONLY in the v2 pipeline.
 * Wired in `generate-trip-day-v2.ts` between `enrichAndValidateHours` and
 * `runScheduleExecutioner`. Locked / user / manual / extracted / pinned /
 * booked rows are exempt from every pass.
 *
 *   1. overlapAutoShift     — Push later activities forward in 15-min
 *                             increments to clear A→B time overlaps. Cap is
 *                             90 min of *cumulative* day-wide shift; on
 *                             breach, the residual overlap is recorded in
 *                             `metadata.quality.unresolved_overlaps` (the
 *                             executioner + read-time auditor pick it up).
 *
 *   2. closingHoursAutoShift — If an activity starts after its venue's
 *                             closing time (or ends after), drop the card
 *                             and stamp `needs_replacement:true` so
 *                             `injectMissingMustDos` / fill-dead-gap can
 *                             refill the slot. `openingHours` shape comes
 *                             from `enrichAndValidateHours` (Google Places).
 *
 *   3. transitSanityWiden   — A transit card with <8min walk duration whose
 *                             prev→next haversine sits in 200–1500m, OR whose
 *                             prev/next sit in distinct neighborhoods, is
 *                             widened to a believable duration (min 10 min,
 *                             scaled at 12 min/km).
 *
 * Sentinels: `[V2_DETECTOR_REPAIRS] day=N overlap=X closing=Y transit=Z`.
 * Counters persisted to `day.metadata.quality.v2_detector_repairs`.
 */

const SHIFT_INCREMENT_MIN = 15;
const SHIFT_CAP_MIN = 90;
const TRANSIT_MIN_DURATION_MIN = 10;
const TRANSIT_MIN_DISTANCE_M = 200;
const TRANSIT_MAX_DISTANCE_M = 1500;
const TRANSIT_BELIEVABLE_THRESHOLD_MIN = 8;
const TRANSIT_PER_KM_MIN = 12;

export interface DetectorRepairCounters {
  overlapsShifted: number;
  overlapsUnresolved: number;
  closingDropped: number;
  transitWidened: number;
  totalShiftMin: number;
}

export interface DetectorRepairResult {
  activities: any[];
  counters: DetectorRepairCounters;
  unresolvedOverlaps: Array<{ index: number; title: string; overlapMin: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseHM(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 27 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function fmtHM(min: number): string {
  const h = Math.floor(((min % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function pickStart(a: any): number | null {
  return parseHM(a?.startTime) ?? parseHM(a?.start_time) ?? parseHM(a?.time);
}
function pickEnd(a: any): number | null {
  return parseHM(a?.endTime) ?? parseHM(a?.end_time);
}
function setStart(a: any, min: number): void {
  const v = fmtHM(min);
  a.startTime = v;
  if (a.start_time !== undefined) a.start_time = v;
  if (a.time !== undefined) a.time = v;
}
function setEnd(a: any, min: number): void {
  const v = fmtHM(min);
  a.endTime = v;
  if (a.end_time !== undefined) a.end_time = v;
}

function isExempt(a: any): boolean {
  if (!a) return true;
  if (a.isLocked || a.locked || a.userLocked) return true;
  const src = String(a.source || a.lockedSource || '').toLowerCase();
  if (['user', 'manual', 'extracted', 'pinned', 'booked', 'imported'].includes(src)) return true;
  const basis = String(a?.cost?.basis || a?.estimatedCost?.basis || '').toLowerCase();
  if (['user', 'user_override', 'booked'].includes(basis)) return true;
  // Transit / bookend rows we don't want to move via overlap shift
  return false;
}

function isTransit(a: any): boolean {
  const cat = String(a?.category || '').toLowerCase();
  const t = String(a?.title || a?.name || '').toLowerCase();
  if (cat === 'transit' || cat === 'transport' || cat === 'transfer' || cat === 'logistics') return true;
  return /^(walk|stroll|transfer|drive|taxi|metro|bus|train)\b/.test(t);
}

function isBookend(a: any): boolean {
  const src = String(a?.source || '').toLowerCase();
  if (src.startsWith('bookend') || src === 'late_nightlife_bookend') return true;
  const cat = String(a?.category || '').toLowerCase();
  if (cat === 'accommodation' || cat === 'lodging') return true;
  return false;
}

function haversineMeters(a: any, b: any): number | null {
  const lat1 = Number(a?.location?.lat ?? a?.lat);
  const lng1 = Number(a?.location?.lng ?? a?.lng);
  const lat2 = Number(b?.location?.lat ?? b?.lat);
  const lng2 = Number(b?.location?.lng ?? b?.lng);
  if (![lat1, lng1, lat2, lng2].every((n) => Number.isFinite(n))) return null;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function neighborhoodOf(a: any): string | null {
  const n = a?.neighborhood ?? a?.location?.neighborhood ?? a?.metadata?.neighborhood;
  if (typeof n !== 'string') return null;
  const trimmed = n.trim().toLowerCase();
  return trimmed || null;
}

// ─── 1. Overlap auto-shift ────────────────────────────────────────────────

function overlapAutoShift(
  activities: any[],
): { shifted: number; totalShiftMin: number; unresolved: Array<{ index: number; title: string; overlapMin: number }> } {
  const unresolved: Array<{ index: number; title: string; overlapMin: number }> = [];
  let totalShift = 0;
  let shifted = 0;

  for (let i = 1; i < activities.length; i++) {
    const prev = activities[i - 1];
    const curr = activities[i];
    const prevEnd = pickEnd(prev);
    const currStart = pickStart(curr);
    if (prevEnd == null || currStart == null) continue;
    if (currStart >= prevEnd) continue; // no overlap

    const overlap = prevEnd - currStart;
    if (overlap <= 0) continue;

    if (isExempt(curr) || isBookend(curr)) {
      unresolved.push({ index: i, title: String(curr?.title || curr?.name || ''), overlapMin: overlap });
      continue;
    }

    const remaining = SHIFT_CAP_MIN - totalShift;
    if (remaining <= 0) {
      unresolved.push({ index: i, title: String(curr?.title || curr?.name || ''), overlapMin: overlap });
      continue;
    }

    // Round up to nearest 15-min increment
    const shiftBy = Math.min(remaining, Math.ceil(overlap / SHIFT_INCREMENT_MIN) * SHIFT_INCREMENT_MIN);
    const currEnd = pickEnd(curr);
    setStart(curr, currStart + shiftBy);
    if (currEnd != null) setEnd(curr, currEnd + shiftBy);
    totalShift += shiftBy;
    shifted++;

    // If shift didn't fully cover overlap, log residual
    if (shiftBy < overlap) {
      unresolved.push({ index: i, title: String(curr?.title || curr?.name || ''), overlapMin: overlap - shiftBy });
    }
  }

  return { shifted, totalShiftMin: totalShift, unresolved };
}

// ─── 2. Closing-hours auto-shift ──────────────────────────────────────────

interface HourWindow { open: number; close: number }

function todayHours(a: any): HourWindow | null {
  // Accept multiple enrich shapes: openingHours.today, hours.today, periods[]
  const today = a?.openingHours?.today ?? a?.hours?.today ?? a?.openingHoursToday;
  if (today && typeof today === 'object') {
    const open = parseHM(today.open);
    const close = parseHM(today.close);
    if (open != null && close != null) return { open, close: close < open ? close + 24 * 60 : close };
  }
  const open = parseHM(a?.openingHours?.open ?? a?.hours?.open);
  const close = parseHM(a?.openingHours?.close ?? a?.hours?.close);
  if (open != null && close != null) return { open, close: close < open ? close + 24 * 60 : close };
  return null;
}

function closingHoursAutoShift(activities: any[]): { dropped: number; survivors: any[] } {
  let dropped = 0;
  const survivors: any[] = [];

  for (const a of activities) {
    if (isExempt(a) || isTransit(a) || isBookend(a)) {
      survivors.push(a);
      continue;
    }
    const hours = todayHours(a);
    const start = pickStart(a);
    const end = pickEnd(a) ?? start;
    if (!hours || start == null) {
      survivors.push(a);
      continue;
    }
    // Conflict = start before open OR start >= close OR end > close (with 15min grace)
    const startsAfterClose = start >= hours.close;
    const endsAfterClose = end != null && end > hours.close + 15;
    const startsBeforeOpen = start < hours.open;

    if (startsAfterClose || endsAfterClose || startsBeforeOpen) {
      dropped++;
      // Don't actually drop — replace with a placeholder marked needs_replacement
      survivors.push({
        ...a,
        needs_replacement: true,
        metadata: {
          ...(a.metadata || {}),
          dropped_reason: startsAfterClose
            ? 'starts_after_close'
            : endsAfterClose
            ? 'ends_after_close'
            : 'starts_before_open',
          original_title: a.title || a.name,
          venue_hours: { open: fmtHM(hours.open), close: fmtHM(hours.close % (24 * 60)) },
        },
      });
    } else {
      survivors.push(a);
    }
  }
  return { dropped, survivors };
}

// ─── 3. Transit-sanity widen ──────────────────────────────────────────────

function transitSanityWiden(activities: any[]): { widened: number } {
  let widened = 0;
  for (let i = 0; i < activities.length; i++) {
    const t = activities[i];
    if (!isTransit(t)) continue;
    if (isExempt(t)) continue;

    const start = pickStart(t);
    const end = pickEnd(t);
    if (start == null || end == null) continue;
    const duration = end - start;
    if (duration >= TRANSIT_BELIEVABLE_THRESHOLD_MIN) continue;

    const prev = activities[i - 1];
    const next = activities[i + 1];
    if (!prev || !next) continue;

    const dist = haversineMeters(prev, next);
    const prevHood = neighborhoodOf(prev);
    const nextHood = neighborhoodOf(next);
    const hoodMismatch = !!(prevHood && nextHood && prevHood !== nextHood);
    const distInRange = dist != null && dist >= TRANSIT_MIN_DISTANCE_M && dist <= TRANSIT_MAX_DISTANCE_M;

    if (!hoodMismatch && !distInRange) continue;

    const km = dist != null ? dist / 1000 : 0.5;
    const newDuration = Math.max(TRANSIT_MIN_DURATION_MIN, Math.ceil(km * TRANSIT_PER_KM_MIN));
    if (newDuration <= duration) continue;

    setEnd(t, start + newDuration);
    t.metadata = t.metadata || {};
    t.metadata.transit_widened = {
      from_min: duration,
      to_min: newDuration,
      distance_m: dist,
      reason: hoodMismatch ? 'neighborhood_mismatch' : 'distance_band',
    };
    widened++;
  }
  return { widened };
}

// ─── Entry point ──────────────────────────────────────────────────────────

export function runDetectorRepairs(
  activities: any[],
  dayNumber: number,
): DetectorRepairResult {
  const counters: DetectorRepairCounters = {
    overlapsShifted: 0,
    overlapsUnresolved: 0,
    closingDropped: 0,
    transitWidened: 0,
    totalShiftMin: 0,
  };
  if (!Array.isArray(activities) || activities.length === 0) {
    return { activities: activities || [], counters, unresolvedOverlaps: [] };
  }

  // Pass 1: closing-hours (do this FIRST so the overlap pass doesn't shift
  // a card that's about to be dropped).
  const close = closingHoursAutoShift(activities);
  counters.closingDropped = close.dropped;
  let work = close.survivors;

  // Pass 2: overlap auto-shift
  const ov = overlapAutoShift(work);
  counters.overlapsShifted = ov.shifted;
  counters.overlapsUnresolved = ov.unresolved.length;
  counters.totalShiftMin = ov.totalShiftMin;

  // Pass 3: transit-sanity widen
  const tw = transitSanityWiden(work);
  counters.transitWidened = tw.widened;

  console.log(
    `[V2_DETECTOR_REPAIRS] day=${dayNumber} overlap=${counters.overlapsShifted} ` +
    `unresolved=${counters.overlapsUnresolved} closing=${counters.closingDropped} ` +
    `transit=${counters.transitWidened} shiftMin=${counters.totalShiftMin}`,
  );

  return { activities: work, counters, unresolvedOverlaps: ov.unresolved };
}
