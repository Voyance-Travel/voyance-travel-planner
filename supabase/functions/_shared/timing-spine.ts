/**
 * timing-spine — single canonical surface for parsing, role-classification,
 * sort-keying, and bookend clamping of itinerary activities.
 *
 * Background
 * ──────────
 * Itinerary timing was historically managed by ~8 ad-hoc parsers and 4
 * separate role-detection predicates spread across `_shared/*`, the
 * generate-itinerary pipeline, the FE parser, and the health engine.
 * That fragmentation is the root cause of the recurring "time collapse"
 * class: a pre-dawn Day-1 arrival flight classified as a "departure tail",
 * a 21:20→05:20 hotel-return that wraps past midnight, a 00:55 late-
 * nightlife bookend sorted to the top of the day, etc.
 *
 * Contract
 * ────────
 * Every NEW timing-aware code path MUST import from this module rather
 * than re-implementing parseTime / role classification / clamping.
 *
 *   import {
 *     parseClock, classifyRole, chronoSortKey, clampBookendEnd,
 *     isArrivalLogistics, isDepartureTerminal, isBookendCard,
 *   } from '../_shared/timing-spine.ts';
 *
 * Existing call sites are routed through this module incrementally — see
 * mem://constraints/itinerary/canonical-time-field-promotion and the new
 * `timing-spine` constraint memory.
 *
 * The functions exported here are deliberately thin wrappers over the
 * already-canonical implementations in `timing-cascade.ts`, `clamp-bookend.ts`,
 * and `bookend-verification.ts`. This module ADDS:
 *
 *   • parseClock(activity, field?)  — reads startTime/start_time/time/endTime/end_time
 *   • classifyRole(activity)        — single source of role truth
 *   • chronoSortKey(activity, opts) — wrap-aware role-aware sort key
 *
 * It does NOT introduce new behavior; existing tests around bookend
 * clamping, late-nightlife wrap, arrival-logistics exemption, and pre-dawn
 * cascade normalization remain authoritative.
 */

import {
  parseTime as _parseTime,
  dayChronoKey as _dayChronoKey,
} from './timing-cascade.ts';
import {
  clampBookendEndTime as _clampBookendEndTime,
  isBookendCard as _isBookendCard,
  type ClampBookendOptions,
  type ClampBookendResult,
} from './clamp-bookend.ts';

// ─── 1. parseClock ───────────────────────────────────────────────────────────
/**
 * Parse any of the canonical clock fields from an activity. Returns
 * minutes-since-midnight, or `null` when no field is present / parseable.
 *
 * Field precedence (highest → lowest): startTime, start_time, time,
 * endTime, end_time. Pass an explicit `field` to read a single field.
 */
export function parseClock(
  source: unknown,
  field?: 'startTime' | 'endTime' | 'time',
): number | null {
  if (typeof source === 'string') return _parseTime(source);
  if (!source || typeof source !== 'object') return null;
  const a = source as Record<string, unknown>;
  if (field === 'startTime') {
    return _parseTime(
      (a.startTime as string | undefined) ??
        (a.start_time as string | undefined) ??
        (a.time as string | undefined) ??
        null,
    );
  }
  if (field === 'endTime') {
    return _parseTime(
      (a.endTime as string | undefined) ??
        (a.end_time as string | undefined) ??
        null,
    );
  }
  if (field === 'time') {
    return _parseTime((a.time as string | undefined) ?? null);
  }
  // Default: pick first non-null in canonical order.
  return (
    _parseTime((a.startTime as string | undefined) ?? null) ??
    _parseTime((a.start_time as string | undefined) ?? null) ??
    _parseTime((a.time as string | undefined) ?? null) ??
    _parseTime((a.endTime as string | undefined) ?? null) ??
    _parseTime((a.end_time as string | undefined) ?? null)
  );
}

// ─── 2. classifyRole ─────────────────────────────────────────────────────────
export type ActivityRole =
  | 'arrival-logistics'
  | 'departure-logistics'
  | 'hotel-return'
  | 'late-nightlife-bookend'
  | 'meal'
  | 'normal';

const ARRIVAL_TITLE_RE = /\b(arrival|inbound|landing|land\s+at|arrive)\b/i;
const ARRIVAL_ANCHOR_RE = /^(arrival-flight|airport-transfer)$/i;
const ARRIVAL_SOURCE_RE =
  /^(repair-arrival-flight|repair-airport-transfer|repair-arrival-flight-reconciled|injected-arrival-flight)$/i;
const DEPARTURE_FLIGHT_TITLE_RE = /\b(departure|outbound)\b.*\b(flight|airport)\b|\bflight\b.*\b(home|out|back)\b/i;
const DEPARTURE_ANCHOR_RE = /^(departure-flight|transfer-to-airport|airport-departure)$/i;
const HOTEL_RETURN_TITLE_RE =
  /\b(return\s+to|back\s+to|head\s+back\s+to|wind[\s-]?down|retire|end\s+of\s+day\s+at|nightcap)\b/i;
const MEAL_CAT_RE = /\b(dining|restaurant|breakfast|brunch|lunch|dinner|supper|cafe|food)\b/i;
const MEAL_TITLE_RE = /\b(breakfast|brunch|lunch|dinner|supper|nightcap)\b/i;
const FLIGHT_CAT_RE = /\b(flight|transport|transit|transfer|logistics)\b/i;
const AIRPORT_RE = /\b(airport|station|terminal|gate)\b/i;
const BOOKEND_SOURCES = new Set([
  'bookend-validator',
  'bookend-synthesized',
  'bookend-readtime',
  'bookend-overnight',
]);

export function isArrivalLogistics(a: any): boolean {
  if (!a) return false;
  const anchor = String(a.anchorSource || '').toLowerCase();
  if (ARRIVAL_ANCHOR_RE.test(anchor)) return true;
  const src = String(a.source || '').toLowerCase();
  if (ARRIVAL_SOURCE_RE.test(src)) return true;
  const title = String(a.title || a.name || '');
  if (ARRIVAL_TITLE_RE.test(title) && /\b(flight|airport|transfer|terminal|gate)\b/i.test(title)) {
    return true;
  }
  return false;
}

export function isDepartureTerminal(a: any): boolean {
  if (!a) return false;
  if (isArrivalLogistics(a)) return false;
  const anchor = String(a.anchorSource || '').toLowerCase();
  if (DEPARTURE_ANCHOR_RE.test(anchor)) return true;
  const cat = String(a.category || '').toUpperCase();
  const title = String(a.title || a.name || '');
  if (cat === 'FLIGHT' || /\bflight\b/i.test(title)) return true;
  if (DEPARTURE_FLIGHT_TITLE_RE.test(title)) return true;
  if (FLIGHT_CAT_RE.test(cat.toLowerCase()) && AIRPORT_RE.test(title)) return true;
  return false;
}

export function isLateNightlifeBookend(a: any): boolean {
  if (!a) return false;
  return String(a.source || '').toLowerCase() === 'late_nightlife_bookend';
}

export function isHotelReturnRole(a: any): boolean {
  if (!a) return false;
  const title = String(a.title || a.name || '');
  const cat = String(a.category || '').toLowerCase();
  if (HOTEL_RETURN_TITLE_RE.test(title)) return true;
  if (cat === 'stay' || cat === 'accommodation') return true;
  if (BOOKEND_SOURCES.has(String(a.source || '').toLowerCase())) return true;
  return false;
}

export function classifyRole(a: any): ActivityRole {
  if (!a) return 'normal';
  if (isLateNightlifeBookend(a)) return 'late-nightlife-bookend';
  if (isArrivalLogistics(a)) return 'arrival-logistics';
  if (isDepartureTerminal(a)) return 'departure-logistics';
  if (isHotelReturnRole(a)) return 'hotel-return';
  const cat = String(a.category || '').toLowerCase();
  const title = String(a.title || a.name || '');
  if (MEAL_CAT_RE.test(cat) || MEAL_TITLE_RE.test(title)) return 'meal';
  return 'normal';
}

// ─── 3. chronoSortKey ────────────────────────────────────────────────────────
/**
 * Wrap-aware, role-aware sort key for ordering activities within a single day.
 *
 *  • Arrival logistics: forced to day-HEAD even when the clock is pre-dawn
 *    (Istanbul 03:05 arrival flight stays at index 0; never outranks 23:44).
 *  • Late-nightlife bookend & hotel-return roles: pre-dawn (00:00–05:59)
 *    sort keys get `+24h` so they remain at the chronological tail.
 *  • Normal cards: pre-dawn defaults to `+24h` only when explicitly opted-in
 *    via `treatPreDawnAsWrap` (matches existing dayChronoKey behavior used
 *    by parser sort).
 *
 * Cards with no parseable clock sort to the end (`Number.MAX_SAFE_INTEGER`).
 */
export function chronoSortKey(
  a: any,
  opts: { wrapBoundaryMin?: number; treatPreDawnAsWrap?: boolean } = {},
): number {
  const wrap = opts.wrapBoundaryMin ?? 6 * 60;
  const role = classifyRole(a);
  if (role === 'arrival-logistics') {
    // Forced day-head — use raw mins, never wrap-adjusted.
    const t = parseClock(a, 'startTime') ?? parseClock(a, 'endTime');
    return t ?? -1;
  }
  const t = parseClock(a, 'startTime') ?? parseClock(a, 'endTime');
  if (t === null) return Number.MAX_SAFE_INTEGER;
  if (role === 'late-nightlife-bookend' || role === 'hotel-return') {
    return t < wrap ? t + 24 * 60 : t;
  }
  if (opts.treatPreDawnAsWrap !== false) {
    // Default = same wrap-aware behavior as `dayChronoKey` so existing
    // sites swapping in `chronoSortKey` get identical ordering.
    return _dayChronoKey(
      (a?.startTime as string | undefined) ??
        (a?.start_time as string | undefined) ??
        (a?.time as string | undefined) ??
        null,
      { wrapBoundaryMin: wrap },
    );
  }
  return t;
}

// ─── 4. clampBookendEnd (re-export with friendlier name) ─────────────────────
/**
 * Clamp a hotel-return / freshen-up / nightcap card so its `endTime`
 * never wraps past midnight (unless explicitly tagged
 * `source: 'late_nightlife_bookend'` — that's the only legitimate wrap
 * channel and the caller's job to gate).
 *
 * Thin re-export of `clampBookendEndTime` from `clamp-bookend.ts`.
 */
export function clampBookendEnd(
  act: any,
  opts: ClampBookendOptions = {},
): ClampBookendResult {
  return _clampBookendEndTime(act, opts);
}

export const isBookendCard = _isBookendCard;
export { type ClampBookendOptions, type ClampBookendResult } from './clamp-bookend.ts';

// ─── 5. Lifecycle trace helper ───────────────────────────────────────────────
/**
 * Append a stage snapshot to `day.metadata.quality.timing_trace`. Ring-buffered
 * to the last MAX_TIMING_TRACE_STAGES entries so JSONB writes stay bounded.
 *
 * Used by repair / quality / persist / save / parser to leave a postmortem
 * trail in the persisted JSON. Pure metadata — never mutates activities.
 */
export const MAX_TIMING_TRACE_STAGES = 8;

export interface TimingTraceEntry {
  stage: string;
  at: string; // ISO timestamp
  head?: { title: string; start: string | null; role: ActivityRole } | null;
  tail?: { title: string; end: string | null; role: ActivityRole } | null;
  bookendSource?: string | null;
  counts?: { total: number; meal: number; bookend: number };
}

export function appendTimingLifecycleTrace(
  day: any,
  stage: string,
  extra: Partial<TimingTraceEntry> = {},
): void {
  if (!day || typeof day !== 'object') return;
  try {
    day.metadata = day.metadata || {};
    day.metadata.quality = day.metadata.quality || {};
    const arr: TimingTraceEntry[] = Array.isArray(day.metadata.quality.timing_trace)
      ? day.metadata.quality.timing_trace
      : [];

    const acts: any[] = Array.isArray(day.activities) ? day.activities : [];
    let head: TimingTraceEntry['head'] = null;
    let tail: TimingTraceEntry['tail'] = null;
    let meal = 0;
    let bookend = 0;

    if (acts.length > 0) {
      const sorted = [...acts].sort((a, b) => chronoSortKey(a) - chronoSortKey(b));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      head = {
        title: String(first?.title || first?.name || ''),
        start: (first?.startTime as string | undefined) || (first?.start_time as string | undefined) || null,
        role: classifyRole(first),
      };
      tail = {
        title: String(last?.title || last?.name || ''),
        end: (last?.endTime as string | undefined) || (last?.end_time as string | undefined) || null,
        role: classifyRole(last),
      };
      for (const a of acts) {
        const r = classifyRole(a);
        if (r === 'meal') meal++;
        if (r === 'hotel-return' || r === 'late-nightlife-bookend') bookend++;
      }
    }

    arr.push({
      stage,
      at: new Date().toISOString(),
      head,
      tail,
      bookendSource: extra.bookendSource ?? null,
      counts: { total: acts.length, meal, bookend },
      ...extra,
    });

    while (arr.length > MAX_TIMING_TRACE_STAGES) arr.shift();
    day.metadata.quality.timing_trace = arr;
  } catch (e) {
    // Never block a write for trace stamping.
    console.warn('[timing-spine] appendTimingLifecycleTrace failed:', e);
  }
}
