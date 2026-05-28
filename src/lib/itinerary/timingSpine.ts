/**
 * timingSpine — frontend mirror of `supabase/functions/_shared/timing-spine.ts`.
 *
 * Single canonical surface for parsing, role-classification, and sort-keying
 * itinerary activities in the FE parser, health engine, bookend injector,
 * and display layer. See the backend file for full contract.
 *
 * IMPORTANT: this is a port, not an import — Deno edge modules cannot be
 * pulled into the Vite bundle. Keep the two files semantically equivalent
 * when adding new rules.
 *
 * Memory: mem://constraints/itinerary/timing-spine-canonical
 */

import { dayChronoKey as _dayChronoKey } from './dayChronoKey';

// ─── parseClock ──────────────────────────────────────────────────────────────
export function parseClock(
  source: unknown,
  field?: 'startTime' | 'endTime' | 'time',
): number | null {
  if (typeof source === 'string') return parseClockString(source);
  if (!source || typeof source !== 'object') return null;
  const a = source as Record<string, unknown>;
  if (field === 'startTime') {
    return parseClockString(
      (a.startTime as string | undefined) ??
        (a.start_time as string | undefined) ??
        (a.time as string | undefined) ??
        null,
    );
  }
  if (field === 'endTime') {
    return parseClockString(
      (a.endTime as string | undefined) ?? (a.end_time as string | undefined) ?? null,
    );
  }
  if (field === 'time') {
    return parseClockString((a.time as string | undefined) ?? null);
  }
  return (
    parseClockString((a.startTime as string | undefined) ?? null) ??
    parseClockString((a.start_time as string | undefined) ?? null) ??
    parseClockString((a.time as string | undefined) ?? null) ??
    parseClockString((a.endTime as string | undefined) ?? null) ??
    parseClockString((a.end_time as string | undefined) ?? null)
  );
}

function parseClockString(t: string | undefined | null): number | null {
  if (!t) return null;
  const m = String(t).trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// ─── classifyRole ────────────────────────────────────────────────────────────
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
// Nightcap intentionally NOT here — a nightcap is nightlife, not a hotel-return
// bookend. Classifying it as hotel-return hides morning-nightcap bugs from gap
// and health checks (Rome 9 AM nightcap pattern).
const HOTEL_RETURN_TITLE_RE =
  /\b(return\s+to|back\s+to|head\s+back\s+to|wind[\s-]?down|retire|end\s+of\s+day\s+at)\b/i;
const MEAL_CAT_RE = /\b(dining|restaurant|breakfast|brunch|lunch|dinner|supper|cafe|food)\b/i;
const MEAL_TITLE_RE = /\b(breakfast|brunch|lunch|dinner|supper)\b/i;
const NIGHTLIFE_TITLE_RE = /\b(nightcap|speakeasy|rooftop\s+bar|cocktail|aperitif|aperitivo|wine\s+bar)\b/i;
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

// ─── chronoSortKey ───────────────────────────────────────────────────────────
/**
 * Wrap-aware, role-aware sort key. Mirrors backend `chronoSortKey`.
 *  • Arrival logistics: forced to day-HEAD even when pre-dawn (Day 1).
 *  • Late-nightlife & hotel-return: pre-dawn → +24h (stay at tail).
 *  • Normal: pre-dawn → +24h by default (matches existing dayChronoKey
 *    behavior used by parser sort).
 */
export function chronoSortKey(
  a: any,
  opts: { wrapBoundaryMin?: number; treatPreDawnAsWrap?: boolean } = {},
): number {
  const wrap = opts.wrapBoundaryMin ?? 6 * 60;
  const role = classifyRole(a);
  if (role === 'arrival-logistics') {
    const t = parseClock(a, 'startTime') ?? parseClock(a, 'endTime');
    return t ?? -1;
  }
  const t = parseClock(a, 'startTime') ?? parseClock(a, 'endTime');
  if (t === null) return Number.MAX_SAFE_INTEGER;
  if (role === 'late-nightlife-bookend' || role === 'hotel-return') {
    return t < wrap ? t + 24 * 60 : t;
  }
  if (opts.treatPreDawnAsWrap !== false) {
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
