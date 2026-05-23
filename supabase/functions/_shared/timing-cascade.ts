/**
 * timing-cascade — Shared algorithm that the generator and refresh-day both use
 * to detect & resolve timing conflicts deterministically.
 *
 * Catches three classes of conflict the generator's TIME_OVERLAP cascade misses:
 *
 *   1. Same-start: two consecutive cards with identical startTime
 *      (typically a 0-duration transit stub jammed in front of its target).
 *   2. Plain overlap: currEnd > nextStart.
 *   3. Insufficient buffer: even when there's no overlap, two distinct-coordinate
 *      cards back-to-back without enough time for the haversine-estimated walk
 *      / transit + a category-aware minimum buffer.
 *
 * Mutates the activities array in place (and also returns it) so callers can
 * thread it through their own logging conventions.
 */

import { clampBookendEndTime } from './clamp-bookend.ts';
import { qualifiesAsLateNightlife } from './late-nightlife-predicate.ts';

export interface CascadeActivity {
  id: string;
  title?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  location?: { lat?: number; lng?: number; address?: string; name?: string };
  // Anything else passes through untouched.
  [k: string]: unknown;
}

export interface CascadeRepair {
  type: 'same_start_fix' | 'overlap_fix' | 'buffer_fix' | 'dropped_past_midnight' | 'bookend_clamped' | 'transit_recomputed' | 'transit_unverified' | 'transit_duration_clamped';
  activityId: string;
  activityTitle?: string;
  before?: string;
  after?: string;
  message: string;
}

export interface CascadeOptions {
  /** Activities that may not be moved or dropped. */
  lockedIds?: Set<string>;
  /** Cutoff minute-of-day used when clamping late activities. Defaults to 23:30. */
  cutoffMinutes?: number;
  /** Buffer added when resolving overlap/same-start (in minutes). Default 5. */
  overlapBufferMinutes?: number;
}

export interface CascadeResult<T extends CascadeActivity> {
  activities: T[];
  repairs: CascadeRepair[];
  droppedIds: string[];
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

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

/**
 * Wrap-aware sort key for ordering activities WITHIN a single day.
 *
 * Times in the early-AM window (default `[00:00, 06:00)`) belong to the *end*
 * of the parent day — e.g. a 23:30 nightcap followed by a 00:55 hotel-return
 * bookend. Without this, raw `mins-since-midnight` sorts re-order the bookend
 * to the TOP of the day. Mirrors `ensureHotelReturnBookend`'s `norm()`.
 *
 * Returns `Number.MAX_SAFE_INTEGER` for unparseable / empty inputs so untimed
 * rows always sort to the end.
 */
export function dayChronoKey(
  startTime: unknown,
  opts: { wrapBoundaryMin?: number } = {},
): number {
  const wrap = opts.wrapBoundaryMin ?? 6 * 60;
  const t = parseTime(typeof startTime === 'string' ? startTime : null);
  if (t === null) return Number.MAX_SAFE_INTEGER;
  return t < wrap ? t + 24 * 60 : t;
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

/**
 * Fill missing `startTime` from `endTime − durationMinutes` when possible.
 *
 * Closes the "card renders as bare → 1:30 PM" leak (Day 3 Bistro Refter).
 * Mutates each activity in place. Locked / user-anchored cards are exempt.
 * Returns counts for telemetry.
 *
 * Sentinels:
 *   [NORMALIZE_START]          — filled startTime
 *   [NORMALIZE_START_SKIPPED]  — couldn't fill (no duration, or unparseable end)
 */
export function fillMissingStartTimes(
  activities: any[],
  opts: { dayNumber?: number; path?: string } = {}
): { filled: number; skipped: number } {
  let filled = 0;
  let skipped = 0;
  const day = opts.dayNumber ?? '?';
  const path = opts.path ?? 'unknown';
  for (const a of activities || []) {
    if (!a || typeof a !== 'object') continue;
    // Exempt user-anchored / locked rows — never recompute their time.
    if (a.isLocked || a.locked || a.lock_state === 'locked'
        || a.userAdded || a.userEdited || a.isManual
        || a.extracted || a.pinned) continue;
    // PROMOTE: `time` and `start_time` are aliases of `startTime`. If only an
    // alias is set, copy it into the canonical `startTime` field so every
    // downstream pass that reads `a.startTime` sees the time. Mirror endTime
    // ↔ end_time. Closes the recurring "untimed departure-day lunch sorted
    // after the airport transfer" leak (Faro/Bruges/Milan/Mallorca/HK/CDMX/SJU).
    if (!a.startTime && (a.start_time || a.time)) {
      const promoted = a.start_time || a.time;
      a.startTime = promoted;
      a.start_time = promoted;
      a.time = promoted;
      console.log(`[NORMALIZE_START_PROMOTE] day=${day} title="${a.title || a.name || ''}" from=${a.start_time === promoted && !a.time ? 'start_time' : 'time'} value=${promoted} path=${path}`);
    }
    if (!a.endTime && a.end_time) {
      a.endTime = a.end_time;
    } else if (!a.end_time && a.endTime) {
      a.end_time = a.endTime;
    }
    const start = a.startTime || a.start_time || a.time;
    if (start) continue; // already has a start; nothing to do
    const end = a.endTime || a.end_time;
    if (!end) continue; // no anchor to compute from — leave as-is
    const dur = Number(a.durationMinutes ?? a.duration_minutes);
    if (!Number.isFinite(dur) || dur <= 0) {
      skipped++;
      console.log(`[NORMALIZE_START_SKIPPED] day=${day} title="${a.title || a.name || ''}" reason=no_duration end=${end} path=${path}`);
      continue;
    }
    const endMin = parseTime(end);
    if (endMin === null) {
      skipped++;
      console.log(`[NORMALIZE_START_SKIPPED] day=${day} title="${a.title || a.name || ''}" reason=unparseable_end end=${end} path=${path}`);
      continue;
    }
    const startMin = Math.max(0, endMin - dur);
    const computed = minutesToTime(startMin);
    a.startTime = computed;
    a.start_time = computed;
    a.time = computed;
    filled++;
    console.log(`[NORMALIZE_START] day=${day} title="${a.title || a.name || ''}" computed=${computed} from end=${end} dur=${dur} path=${path}`);
  }
  return { filled, skipped };
}

// ─── Floating-meal time assigner ──────────────────────────────────────────────
// A "floating" meal card has no startTime, no endTime, AND no duration to
// compute either from — fillMissingStartTimes can't help it. Result in UI is a
// dinner card sitting at the bottom of the day with no time, often duplicated.
// This pass assigns canonical meal slots (or drops a clear duplicate) so the
// card either anchors visibly or disappears.
const MEAL_SLOT_RE = /\b(breakfast|brunch|lunch|dinner|supper|nightcap)\b/i;
function mealKindOf(act: any): 'breakfast' | 'brunch' | 'lunch' | 'dinner' | null {
  const t = `${act?.title || ''} ${act?.name || ''}`.toLowerCase();
  if (/\bdinner\b|\bsupper\b/.test(t)) return 'dinner';
  if (/\blunch\b/.test(t)) return 'lunch';
  if (/\bbrunch\b/.test(t)) return 'brunch';
  if (/\bbreakfast\b/.test(t)) return 'breakfast';
  return null;
}
const DEFAULT_SLOT: Record<string, { start: string; end: string; lux: { start: string; end: string } }> = {
  breakfast: { start: '08:30', end: '09:30', lux: { start: '09:00', end: '10:00' } },
  brunch:    { start: '11:00', end: '12:00', lux: { start: '11:30', end: '12:30' } },
  lunch:     { start: '13:00', end: '14:00', lux: { start: '13:30', end: '14:45' } },
  dinner:    { start: '19:30', end: '21:00', lux: { start: '20:00', end: '21:45' } },
};

export function assignFloatingMealTimes(
  activities: any[],
  opts: { dayNumber?: number; budgetTier?: string; path?: string } = {}
): { assigned: number; dropped: number } {
  if (!Array.isArray(activities) || activities.length === 0) return { assigned: 0, dropped: 0 };
  const day = opts.dayNumber ?? '?';
  const path = opts.path ?? 'unknown';
  const isLux = /luxury|luminary|splurge|premium/i.test(opts.budgetTier || '');

  // Identify which meal slots already have a timed card.
  const slotTaken: Record<string, boolean> = { breakfast: false, brunch: false, lunch: false, dinner: false };
  for (const a of activities) {
    if (!a) continue;
    if (a.startTime || a.start_time || a.time || a.endTime || a.end_time) {
      const kind = mealKindOf(a);
      if (kind && slotTaken[kind] === false) slotTaken[kind] = true;
    }
  }

  let assigned = 0;
  let dropped = 0;
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    if (!a || typeof a !== 'object') continue;
    if (a.isLocked || a.locked || a.lock_state === 'locked'
        || a.userAdded || a.userEdited || a.isManual
        || a.extracted || a.pinned) continue;
    // PROMOTE alias time/start_time → startTime so a card timed only via
    // `time` doesn't get treated as floating below.
    if (!a.startTime && (a.start_time || a.time)) {
      const promoted = a.start_time || a.time;
      a.startTime = promoted;
      a.start_time = promoted;
      a.time = promoted;
      console.log(`[NORMALIZE_START_PROMOTE] day=${day} title="${a.title || a.name || ''}" from=alias value=${promoted} path=${path}-floating`);
    }
    if (!a.endTime && a.end_time) a.endTime = a.end_time;
    if (a.startTime || a.start_time || a.time) continue;
    // endTime-only meal cards (no startTime, no duration) used to be skipped
    // here, leaving cards like "Lunch at El Turix" persisted with only an
    // endTime. Backfill a sensible start by walking back from endTime using
    // the canonical meal-slot duration so the card anchors visibly.
    const endStr = a.endTime || a.end_time;
    const durRaw = Number(a.durationMinutes ?? a.duration_minutes);
    const hasDur = Number.isFinite(durRaw) && durRaw > 0;
    if (endStr || hasDur) {
      const kind = mealKindOf(a);
      if (!kind) continue;
      const slot = DEFAULT_SLOT[kind];
      if (!slot) continue;
      const { start: defaultStart, end: defaultEnd } = isLux ? slot.lux : slot;
      const slotDur = parseTime(defaultEnd)! - parseTime(defaultStart)!;
      const useDur = hasDur ? durRaw : slotDur;
      let startStr: string;
      let computedEnd: string | undefined;
      if (endStr) {
        const endMin = parseTime(endStr);
        if (endMin === null) continue;
        const startMin = Math.max(0, endMin - useDur);
        startStr = minutesToTime(startMin);
      } else {
        // duration-only — pin to canonical slot start.
        startStr = defaultStart;
        const startMin = parseTime(startStr)!;
        computedEnd = minutesToTime(startMin + useDur);
      }
      a.startTime = startStr;
      a.start_time = startStr;
      a.time = startStr;
      if (computedEnd) {
        a.endTime = computedEnd;
        a.end_time = computedEnd;
      }
      // Mark slot taken so further floating duplicates of this meal drop.
      if (slotTaken[kind] === false) slotTaken[kind] = true;
      assigned++;
      console.log(`[FLOATING_MEAL_BACKFILL_START] day=${day} kind=${kind} start=${startStr} title="${a.title || a.name || ''}" path=${path}`);
      continue;
    }

    const kind = mealKindOf(a);
    if (!kind) continue;

    if (slotTaken[kind]) {
      // A timed card for this meal already exists. Before dropping the floating
      // duplicate, ensure it does NOT carry real venue content (name, address,
      // description). Content preservation is non-negotiable: a meal-guard stub
      // can have a time while the real LLM-generated card was left floating —
      // dropping the wrong one removes the real content.
      const hasRealVenue = !!(
        (a?.location?.name && String(a.location.name).trim() && !/^your hotel$/i.test(String(a.location.name).trim())) ||
        (a?.venue_name && String(a.venue_name).trim()) ||
        (a?.restaurant?.name && String(a.restaurant.name).trim())
      );
      const hasRealDescription = typeof a?.description === 'string' && a.description.trim().length >= 30;
      if (hasRealVenue || hasRealDescription) {
        // Treat THIS as the canonical card — assign default times and keep.
        // Mark the slot as still taken so any further duplicates in this pass do drop.
        const slot = DEFAULT_SLOT[kind];
        if (slot) {
          const { start, end } = isLux ? slot.lux : slot;
          a.startTime = start;
          a.start_time = start;
          a.time = start;
          a.endTime = end;
          a.end_time = end;
          assigned++;
          console.log(`[FLOATING_MEAL_PROMOTE] day=${day} kind=${kind} title="${a.title || a.name || ''}" reason=real_content path=${path}`);
        }
        continue;
      }
      activities.splice(i, 1);
      dropped++;
      console.log(`[FLOATING_MEAL_DROP] day=${day} kind=${kind} title="${a.title || a.name || ''}" path=${path}`);
      continue;
    }

    const slot = DEFAULT_SLOT[kind];
    if (!slot) continue;
    const { start, end } = isLux ? slot.lux : slot;
    a.startTime = start;
    a.start_time = start;
    a.time = start;
    a.endTime = end;
    a.end_time = end;
    slotTaken[kind] = true;
    assigned++;
    console.log(`[FLOATING_MEAL_ASSIGN] day=${day} kind=${kind} start=${start} end=${end} title="${a.title || a.name || ''}" path=${path}`);
  }
  return { assigned, dropped };
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export interface TransitEstimate {
  fromId: string;
  toId: string;
  method: string;
  durationMinutes: number;
  distance: string;
  recommended?: boolean;
  /** True when coords were missing — minutes are a best-guess default. */
  unverified?: boolean;
}

/**
 * Estimate the walk/transit/taxi time between two activities from coords.
 * Returns `null` when coords are missing (preserved for legacy callers).
 *
 * Hard floor: anything more than a same-building hop (~80m) takes at least
 * 4 min — closes "AI-emitted 5 min walk between distant venues" leak.
 */
export function estimateTransit(a: CascadeActivity, b: CascadeActivity): TransitEstimate | null {
  if (a.location?.lat == null || b.location?.lat == null || a.location?.lng == null || b.location?.lng == null) return null;
  const distMeters = haversineMeters(
    { lat: a.location.lat, lng: a.location.lng },
    { lat: b.location.lat, lng: b.location.lng }
  );
  const walkMinRaw = Math.ceil(distMeters / 80);
  const walkMin = distMeters >= 80 ? Math.max(4, walkMinRaw) : walkMinRaw;
  const taxiMin = Math.max(3, Math.ceil(distMeters / 400));
  const isWalkable = walkMin <= 15;
  return {
    fromId: a.id,
    toId: b.id,
    method: isWalkable ? 'walking' : distMeters < 10000 ? 'transit' : 'taxi',
    durationMinutes: isWalkable ? walkMin : distMeters < 10000 ? Math.max(5, Math.ceil(distMeters / 500) + 5) : taxiMin,
    distance: distMeters < 1000 ? `${Math.round(distMeters)}m` : `${(distMeters / 1000).toFixed(1)}km`,
    recommended: true,
  };
}

/**
 * Best-effort estimate that never returns null. Missing coords → typed
 * `unverified` walking estimate (15 min); the recompute pass flags the card
 * `metadata.transit_unverified=true` so the FE health panel can suppress
 * downstream "5 min conflict" warnings on cards we can't actually validate.
 */
export function estimateTransitOrUnverified(a: CascadeActivity, b: CascadeActivity): TransitEstimate {
  const est = estimateTransit(a, b);
  if (est) return est;
  return {
    fromId: a.id,
    toId: b.id,
    method: 'walking',
    durationMinutes: 15,
    distance: 'unknown',
    recommended: false,
    unverified: true,
  };
}

// ─── Category / location helpers ──────────────────────────────────────────────

const TRANSIT_CATS = ['transportation', 'transit', 'transfer', 'taxi', 'transport', 'commute', 'travel'];
const ACCOMMODATION_CATS = ['accommodation', 'hotel', 'lodging'];

export function isSamePlace(a: CascadeActivity, b: CascadeActivity): boolean {
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

export function getEffectiveMinBuffer(from: CascadeActivity, to: CascadeActivity): number {
  const catBuffer = getMinBufferMinutes(from.category, to.category);
  if (catBuffer === 0 && !isSamePlace(from, to)) return 5;
  return catBuffer;
}

// ─── Structural detection (cards we'd rather not push) ────────────────────────

const STRUCTURAL_CATS = new Set(['accommodation', 'hotel', 'stay']);
const STRUCTURAL_KW = ['checkout', 'check-out', 'check out', 'departure flight', 'flight departure', 'airport security'];

function isStructural(act: CascadeActivity, lockedIds: Set<string>): boolean {
  if (lockedIds.has(act.id)) return true;
  const cat = (act.category || '').toLowerCase();
  const title = (act.title || '').toLowerCase();
  if (STRUCTURAL_CATS.has(cat)) return true;
  return STRUCTURAL_KW.some(kw => title.includes(kw));
}

// End-of-day bookend cards exempt from the past-midnight cutoff.
function isEndOfDayBookend(act: CascadeActivity): boolean {
  const cat = (act.category || '').toLowerCase();
  const title = (act.title || '').toLowerCase();
  if (cat === 'accommodation' && (title.includes('return to') || title.includes('freshen up') || title.includes('check-in') || title.includes('check in'))) return true;
  if ((cat === 'transport' || cat === 'transportation') && (title.includes('hotel') || ((act.location?.name || '') as string).toLowerCase().includes('hotel'))) return true;
  return false;
}

// ─── Transit-card recompute ───────────────────────────────────────────────────
// AI-emitted "Walk to X — 5 min" cards routinely undershoot reality. This pass
// rewrites each transit card's `durationMinutes` (and recomputes `endTime`)
// from a Haversine estimate between its immediate non-transit neighbours.
// Locked / user-edited / booked / manually-added rows are exempt. Cards we
// can't validate (missing coords on either neighbour) get tagged
// `metadata.transit_unverified = true` so the FE health panel can suppress
// "X min conflict" warnings for best-effort estimates.

const TRANSIT_TITLE_RE = /^(walk|stroll|transit|transfer|taxi|drive|bus|metro|tram|train|ride|bike|cycle|uber|lyft|cab)\b/i;

function isTransitCard(a: CascadeActivity): boolean {
  const cat = String(a.category || '').toLowerCase();
  if (TRANSIT_CATS.some(t => cat.includes(t))) return true;
  return TRANSIT_TITLE_RE.test(String(a.title || ''));
}

function isUntouchableByRecompute(a: any, lockedIds: Set<string>): boolean {
  if (lockedIds.has(a?.id)) return true;
  if (a?.manuallyAdded || a?.extracted || a?.pinned || a?.isLocked) return true;
  if (a?.lockState === 'locked') return true;
  const basis = a?.cost?.basis || a?.estimatedCost?.basis;
  if (basis === 'user' || basis === 'user_override' || basis === 'booked' || basis === 'manual' || basis === 'imported') return true;
  return false;
}

export interface TransitRecomputeResult {
  repairs: CascadeRepair[];
  recomputed: number;
  unverified: number;
}

/**
 * Walks the day in order. For each transit card, finds the prior and next
 * NON-transit neighbours and recomputes the transit card's `durationMinutes`
 * (and `endTime`) from `estimateTransit(prev, next)`. Same-place neighbours
 * (already ≤ ~80m apart) skip — the card represents in-venue movement.
 * Mutates `activities` in place. Returns a small summary for telemetry.
 */
export function recomputeTransitCards<T extends CascadeActivity>(
  activities: T[],
  lockedIds: Set<string>,
): TransitRecomputeResult {
  const repairs: CascadeRepair[] = [];
  let recomputed = 0;
  let unverified = 0;

  for (let i = 0; i < activities.length; i++) {
    const card = activities[i];
    if (!isTransitCard(card)) continue;
    if (isUntouchableByRecompute(card, lockedIds)) continue;

    // Find immediate non-transit neighbours within this day.
    let prev: CascadeActivity | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (!isTransitCard(activities[j])) { prev = activities[j]; break; }
    }
    let next: CascadeActivity | null = null;
    for (let j = i + 1; j < activities.length; j++) {
      if (!isTransitCard(activities[j])) { next = activities[j]; break; }
    }
    if (!prev || !next) continue;
    if (isSamePlace(prev, next)) continue;

    const est = estimateTransitOrUnverified(prev, next);
    const before = `${card.title} @ ${card.startTime} (${(card as any).durationMinutes ?? '?'} min)`;
    const start = parseTime(card.startTime);

    if (est.unverified) {
      // Don't rewrite duration on an unverified estimate — just flag it so
      // the FE can suppress "X min conflict" noise for this card.
      const meta = ((card as any).metadata = (card as any).metadata || {});
      if (meta.transit_unverified !== true) {
        meta.transit_unverified = true;
        unverified++;
        repairs.push({
          type: 'transit_unverified',
          activityId: card.id,
          activityTitle: card.title,
          before,
          message: `"${card.title}" lacked coords on either neighbour — duration left as-is, flagged unverified.`,
        });
      }
      continue;
    }

    const currentDur = Number((card as any).durationMinutes) || (parseTime(card.endTime) !== null && start !== null ? (parseTime(card.endTime)! - start) : 0);
    // Only rewrite when the engine's estimate disagrees by ≥ 3 min — avoids
    // pointless 1-min churn on already-reasonable cards.
    if (Math.abs(est.durationMinutes - currentDur) < 3) continue;

    (card as any).durationMinutes = est.durationMinutes;
    (card as any).duration_minutes = est.durationMinutes;
    if (start !== null) {
      const newEnd = minutesToTime(start + est.durationMinutes);
      card.endTime = newEnd;
      (card as any).end_time = newEnd;
    }
    // Refresh title hint when the AI baked the old duration in.
    if (typeof card.title === 'string') {
      card.title = card.title.replace(/\b\d{1,3}\s*min\b/i, `${est.durationMinutes} min`);
    }
    recomputed++;
    repairs.push({
      type: 'transit_recomputed',
      activityId: card.id,
      activityTitle: card.title,
      before,
      after: `${card.title} @ ${card.startTime} (${est.durationMinutes} min, ${est.method} ${est.distance})`,
      message: `Recomputed transit "${card.title}" from ${currentDur || '?'} → ${est.durationMinutes} min based on ${est.method} ${est.distance} between "${prev.title}" and "${next.title}".`,
    });
  }

  return { repairs, recomputed, unverified };
}

// ─── Core algorithm ───────────────────────────────────────────────────────────



export function enforceTimingAndBuffers<T extends CascadeActivity>(
  input: T[],
  opts: CascadeOptions = {}
): CascadeResult<T> {
  const lockedIds = opts.lockedIds ?? new Set<string>();
  const cutoff = opts.cutoffMinutes ?? (23 * 60 + 30);
  const overlapBuffer = opts.overlapBufferMinutes ?? 5;
  const repairs: CascadeRepair[] = [];

  // Pre-walk: fill missing startTime from endTime − durationMinutes so the sort
  // (and all downstream pair logic) sees a coherent chronology. Mutates input.
  fillMissingStartTimes(input as any[], { path: 'enforceTimingAndBuffers' });
  // Pre-walk #2: assign canonical times to dining cards with no time/end/duration
  // ("floating Day 3 dinner card") so they anchor visibly or drop as dupes.
  assignFloatingMealTimes(input as any[], { path: 'enforceTimingAndBuffers' });
  // Pre-walk #3: remove orphan late-nightlife hotel-return bookends BEFORE the
  // cascade loop sees them. Otherwise a stale 00:30 "Return to Hotel" card
  // anchors Day 2's chronology and the cascade pushes every real activity into
  // 1-7 AM (Budapest Day 2: Parliament @ 1:47 AM, lunch @ 4:47 AM).
  pruneOrphanLateNightlifeBookend(input as any[], { path: 'enforceTimingAndBuffers' } as any);

  // Pre-walk #4: recompute transit-card durations from their neighbours' coords
  // so AI-emitted "Walk to X — 5 min" stubs between distant venues stop
  // surviving into the schedule. Must run BEFORE the chronological sort so
  // the cascade loop sees corrected endTimes when checking overlap/buffer.
  const transitRecompute = recomputeTransitCards(input as any[], lockedIds);
  if (transitRecompute.repairs.length) {
    repairs.push(...transitRecompute.repairs);
    try {
      // eslint-disable-next-line no-console
      console.log(`[CASCADE] transit_recomputed=${transitRecompute.recomputed} transit_unverified=${transitRecompute.unverified}`);
    } catch { /* noop */ }
  }

  // Sort chronologically; activities without a startTime go to the end.
  // Wrap-aware so a 00:55 late-nightlife hotel-return bookend sorts AFTER a
  // 23:30 nightcap instead of jumping to the top of the day.
  let activities = [...input].sort((a, b) => dayChronoKey(a.startTime) - dayChronoKey(b.startTime));

  // Helper: shift an activity (and all later ones, except locked) by `delta` minutes.
  // Caps per-activity cumulative shift at 120 min so a single bad-duration upstream
  // (e.g. 9-hour cocktail bar) cannot destroy the whole day's schedule by pushing
  // every subsequent card past the cutoff. Activities that hit the cap retain their
  // original times and a repair note is emitted.
  const MAX_CUMULATIVE_SHIFT = 120;
  const cumulativeShiftById = new Map<string, number>();
  const cascadeShift = (fromIdx: number, delta: number) => {
    if (delta <= 0) return;
    for (let j = fromIdx; j < activities.length; j++) {
      const act = activities[j];
      if (lockedIds.has(act.id)) continue;
      const currentShift = cumulativeShiftById.get(act.id) ?? 0;
      const allowedDelta = Math.max(0, MAX_CUMULATIVE_SHIFT - currentShift);
      const applyDelta = Math.min(delta, allowedDelta);
      if (applyDelta <= 0) {
        if (currentShift >= MAX_CUMULATIVE_SHIFT) {
          repairs.push({
            type: 'overlap_fix',
            activityId: act.id,
            activityTitle: act.title,
            before: `${act.title} @ ${act.startTime}`,
            after: `${act.title} @ ${act.startTime}`,
            message: `"${act.title}" reached the ${MAX_CUMULATIVE_SHIFT}-min cumulative shift cap — leaving in place. An upstream activity has an excessive duration; review and edit.`,
          });
        }
        continue;
      }
      const s = parseTime(act.startTime);
      const e = parseTime(act.endTime);
      if (s !== null) act.startTime = minutesToTime(s + applyDelta);
      if (e !== null) act.endTime = minutesToTime(e + applyDelta);
      cumulativeShiftById.set(act.id, currentShift + applyDelta);
    }
  };

  // Resolve same-start, overlap, and buffer-too-tight in a single forward pass.
  // Re-evaluate each pair after a shift because cascading subsequent activities
  // can change the geometry of later pairs.
  for (let i = 0; i < activities.length - 1; i++) {
    const curr = activities[i];
    const next = activities[i + 1];
    if (lockedIds.has(next.id)) continue; // never move a locked card

    const currStart = parseTime(curr.startTime);
    const currEnd = parseTime(curr.endTime);
    const nextStart = parseTime(next.startTime);
    if (currStart === null || nextStart === null) continue;

    // Wrap-aware skip: when the next card sits in the early-AM wrap window
    // (e.g. 00:55 hotel-return after a 23:30 nightcap), raw minute math says
    // currEnd > nextStart and would re-shove the bookend by ~hours. Treat
    // wrap-past-midnight pairs as already-spaced and let cascadeShift skip.
    if (nextStart < currStart && nextStart < 6 * 60) continue;

    // 1. Same-start
    if (currStart === nextStart && !isStructural(next, lockedIds)) {
      const anchorEnd = currEnd ?? (currStart + (curr.durationMinutes || 30));
      const target = anchorEnd + overlapBuffer;
      const delta = target - nextStart;
      if (delta > 0) {
        const before = `${next.title} @ ${next.startTime}`;
        cascadeShift(i + 1, delta);
        console.log(`[PERSIST_CASCADE_DETAIL] reason=same_start delta_min=${delta} moved="${next.title}" from=${minutesToTime(nextStart)} to=${next.startTime} anchor="${curr.title}"`);
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

    // 2. Overlap
    if (currEnd !== null && currEnd > nextStart && !isStructural(next, lockedIds)) {
      // Transit cards may butt up against neighbors with a 0-min buffer, but they
      // must never start before the previous activity's endTime.
      const currCatLower = (curr.category || '').toLowerCase();
      const nextCatLower = (next.category || '').toLowerCase();
      const eitherTransit =
        TRANSIT_CATS.some(t => currCatLower.includes(t)) ||
        TRANSIT_CATS.some(t => nextCatLower.includes(t));
      const buffer = eitherTransit ? 0 : overlapBuffer;
      const target = currEnd + buffer;
      const delta = target - nextStart;
      if (delta > 0) {
        const before = `${next.title} @ ${next.startTime}`;
        cascadeShift(i + 1, delta);
        console.log(`[PERSIST_CASCADE_DETAIL] reason=overlap delta_min=${delta} moved="${next.title}" from=${minutesToTime(nextStart)} to=${next.startTime} prevEnd=${minutesToTime(currEnd)} prev="${curr.title}" transit=${eitherTransit}`);
        repairs.push({
          type: 'overlap_fix',
          activityId: next.id,
          activityTitle: next.title,
          before,
          after: `${next.title} @ ${next.startTime}`,
          message: `"${curr.title}" ended at ${minutesToTime(currEnd)} but "${next.title}" started at ${minutesToTime(nextStart)} — pushed forward.`,
        });
      }
      continue;
    }

    // 3. Insufficient buffer (only when no overlap)
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
          const transitNote = transit
            ? `${transit.durationMinutes} min ${transit.method} (${transit.distance}) + ${minBuffer} min buffer`
            : `${minBuffer} min buffer`;
          console.log(`[PERSIST_CASCADE_DETAIL] reason=buffer delta_min=${delta} moved="${next.title}" from=${before.split('@ ')[1]} to=${next.startTime} note="${transitNote}"`);
          repairs.push({
            type: 'buffer_fix',
            activityId: next.id,
            activityTitle: next.title,
            before,
            after: `${next.title} @ ${next.startTime}`,
            message: `Tight transition between "${curr.title}" and "${next.title}" — added ${delta} min (${transitNote}).`,
          });
        }
      }
    }
  }

  // Clamp activities pushed past the cutoff back to 23:29 (was: drop). Content
  // preservation is non-negotiable — users paid for these activities and meals
  // and we never delete them on save/regen. UI can surface a warning that the
  // day is overbooked, but cards stay visible.
  const droppedIds: string[] = []; // intentionally empty — kept for return-shape compatibility
  for (const act of activities) {
    const s = parseTime(act.startTime);
    if (s === null) continue;
    if (s <= cutoff) continue;
    if (lockedIds.has(act.id)) continue;
    if (isEndOfDayBookend(act)) continue;
    const e = parseTime(act.endTime);
    const originalDur = e !== null ? Math.max(15, e - s) : (Number(act.durationMinutes) || 30);
    const clampedStart = cutoff - 1; // 23:29
    const clampedEnd = Math.min(23 * 60 + 59, clampedStart + originalDur);
    const newStart = minutesToTime(clampedStart);
    const newEnd = minutesToTime(clampedEnd);
    repairs.push({
      type: 'overlap_fix',
      activityId: act.id,
      activityTitle: act.title,
      before: `${act.title} @ ${act.startTime}`,
      after: `${act.title} @ ${newStart}`,
      message: `"${act.title}" was pushed past ${minutesToTime(cutoff)} — clamped to ${newStart} to avoid deletion. Day may be overbooked.`,
    });
    act.startTime = newStart;
    (act as any).start_time = newStart;
    act.endTime = newEnd;
    (act as any).end_time = newEnd;
  }

  // Bookend cards survived the cutoff — clamp their endTime ≤ 23:59 so they
  // never bleed into the next day.
  for (const act of activities) {
    if (!isEndOfDayBookend(act)) continue;
    if (lockedIds.has(act.id)) continue;
    const beforeStart = act.startTime;
    const beforeEnd = act.endTime;
    const res = clampBookendEndTime(act, { label: 'CASCADE_BOOKEND' });
    if (res.changed) {
      repairs.push({
        type: 'bookend_clamped',
        activityId: act.id,
        activityTitle: act.title,
        before: `${act.title} @ ${beforeStart}–${beforeEnd}`,
        after: `${act.title} @ ${act.startTime}–${act.endTime}`,
        message: `Clamped bookend "${act.title}" to end ≤ 23:59`,
      });
    }
  }

  return { activities, repairs, droppedIds };
}

/**
 * Prune stale `late_nightlife_bookend` cards whose chronological-prior
 * non-bookend activity isn't actually late-nightlife (or whose start
 * predates the prior's end — impossible chronology).
 *
 * The card is normally exempt from `stripPreDawnHotelReturns` /
 * `isGhostActivity` / `clampAllBookends` (intentional — legitimate
 * post-midnight returns must survive). When the day's true tail changes
 * (regen, edit, swap), the bookend stops describing reality but never
 * gets removed. Result: phantom "12:10 AM Return to Hotel" floats at
 * the head of the next day's view.
 *
 * Mutates `activities` in place. Returns count removed. Sentinel:
 *   [ORPHAN_BOOKEND_PRUNED] day=N reason=…
 */
export function pruneOrphanLateNightlifeBookend(
  activities: any[],
  opts: { dayNumber?: number } = {},
): number {
  if (!Array.isArray(activities) || activities.length < 2) return 0;
  const dayLabel = opts.dayNumber != null ? `day=${opts.dayNumber}` : 'day=?';

  const isLateBookend = (a: any): boolean => {
    if (!a) return false;
    const src = String(a.source || '').toLowerCase();
    if (src === 'late_nightlife_bookend') return true;
    const tags: string[] = Array.isArray(a.tags)
      ? a.tags.map((x: any) => String(x).toLowerCase())
      : [];
    return tags.includes('late_nightlife_bookend');
  };

  let removed = 0;
  for (let i = activities.length - 1; i >= 0; i--) {
    const card = activities[i];
    if (!isLateBookend(card)) continue;

    // Find the chronologically-prior NON-bookend activity. We use
    // dayChronoKey so a 23:30 nightcap precedes a 00:10 bookend, and
    // a 21:00 dinner precedes both.
    const cardKey = dayChronoKey(card.startTime || card.start_time);
    let priorIdx = -1;
    let priorKey = -1;
    for (let j = 0; j < activities.length; j++) {
      if (j === i) continue;
      const other = activities[j];
      if (isLateBookend(other)) continue;
      const k = dayChronoKey(other.startTime || other.start_time);
      if (k === Number.MAX_SAFE_INTEGER) continue;
      if (k < cardKey && k > priorKey) {
        priorKey = k;
        priorIdx = j;
      }
    }

    if (priorIdx < 0) {
      // Bookend with no prior activity at all — definitely orphan.
      activities.splice(i, 1);
      removed++;
      console.warn(`[ORPHAN_BOOKEND_PRUNED] ${dayLabel} reason=no-prior-activity title="${card?.title}"`);
      continue;
    }

    const prior = activities[priorIdx];
    const priorStart = parseTime(prior.startTime || prior.start_time);
    const priorEnd =
      parseTime(prior.endTime || prior.end_time) ?? priorStart;

    if (!qualifiesAsLateNightlife(prior, priorStart, priorEnd)) {
      activities.splice(i, 1);
      removed++;
      console.warn(
        `[ORPHAN_BOOKEND_PRUNED] ${dayLabel} reason=prior-not-nightlife prior="${prior?.title}" (${prior?.startTime}-${prior?.endTime}) bookend="${card?.title}" @ ${card?.startTime}`,
      );
      continue;
    }

    // Impossible chronology: bookend starts BEFORE prior ends.
    const cardStart = parseTime(card.startTime || card.start_time);
    if (cardStart != null && priorEnd != null) {
      // Wrap-aware: if both fall in [00:00, 06:00), use raw mins; otherwise
      // treat early-AM bookend as "after" any pre-midnight prior end.
      const cardWrap = cardStart < 6 * 60 ? cardStart + 24 * 60 : cardStart;
      const priorWrap = priorEnd < 6 * 60 ? priorEnd + 24 * 60 : priorEnd;
      if (cardWrap < priorWrap) {
        activities.splice(i, 1);
        removed++;
        console.warn(
          `[ORPHAN_BOOKEND_PRUNED] ${dayLabel} reason=before-prior-end prior="${prior?.title}" end=${prior?.endTime} bookend=${card?.startTime}`,
        );
      }
    }
  }

  return removed;
}
