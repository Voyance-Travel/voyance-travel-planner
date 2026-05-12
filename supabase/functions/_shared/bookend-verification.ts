/**
 * Bookend verification + invariant — single boundary version.
 *
 * Runs inside `persistTripItinerary(...)` so every write path
 * (fresh generation, intermediate chain saves, action-save-itinerary,
 * chat-action executor) gets the same final pass.
 *
 * For each day it:
 *   1. Computes whether a hotel-return is expected (non-departure day,
 *      non-departure terminal logistics, hotel name resolvable).
 *   2. If expected but missing, runs `runStep8` ONCE to inject a return.
 *   3. Stamps a compact `metadata.quality.bookend_trace` summary describing
 *      what happened — so we can audit persisted JSON in the database
 *      without grepping ephemeral console logs.
 *
 * NEVER touches locked / user / manual / extracted / pinned activities.
 * Failures are non-blocking.
 */

const TRUE_RETURN_RE =
  /\b(?:return\s+to|back\s+to|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\b/i;
const CHECKOUT_RE = /\b(?:check[-\s]?out|checkout)\b/i;
const MIDDAY_ACCOM_RE =
  /\b(?:freshen[-\s]?up|luggage\s+drop|bag\s+drop|settle\s+in|check[-\s]?in|drop\s+(?:bags|luggage))\b/i;
const AIRPORT_RE = /\b(airport|station|terminal|gate)\b/i;
const TRANSPORT_CAT_RE = /TRANSPORT|TRANSIT|TRAVEL|LOGISTICS|FLIGHT/;
const FLIGHT_TITLE_RE = /\b(flight|departure)\b/i;

const BOOKEND_SOURCES = new Set([
  'bookend-validator',
  'bookend-synthesized',
  'bookend-readtime',
  'bookend-overnight',
  'late_nightlife_bookend',
]);

function parseTimeMins(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  return h * 60 + mm;
}

function isLockedRow(a: any): boolean {
  if (!a) return false;
  if (a.locked === true || a.is_locked === true || a.isLocked === true) return true;
  if (a.lock_state === 'locked') return true;
  const src = String(a.source || '').toLowerCase();
  return ['user', 'manual', 'extracted', 'pinned'].includes(src);
}

function isTrueReturn(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toUpperCase();
  const title = String(a.title || a.name || '');
  if (TRUE_RETURN_RE.test(title) || CHECKOUT_RE.test(title)) return true;
  if (cat === 'STAY' || cat === 'ACCOMMODATION') {
    if (MIDDAY_ACCOM_RE.test(title) && !TRUE_RETURN_RE.test(title)) return false;
    return true;
  }
  return false;
}

function isDepartureTerminal(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toUpperCase();
  const title = String(a.title || a.name || '');
  if (cat === 'FLIGHT' || FLIGHT_TITLE_RE.test(title)) return true;
  if (TRANSPORT_CAT_RE.test(cat) && AIRPORT_RE.test(title)) return true;
  return false;
}

function chronologicallyLast(activities: any[]): any | null {
  if (!Array.isArray(activities) || activities.length === 0) return null;
  let bestIdx = activities.length - 1;
  let bestKey = -1;
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const t =
      parseTimeMins(a?.endTime) ??
      parseTimeMins(a?.end_time) ??
      parseTimeMins(a?.startTime) ??
      parseTimeMins(a?.start_time);
    if (t == null) continue;
    // Wrap-aware: treat 00:00–05:59 as next-day so a late-nightlife
    // bookend stays the chronological tail.
    const key = t < 6 * 60 ? t + 24 * 60 : t;
    if (key > bestKey) {
      bestKey = key;
      bestIdx = i;
    }
  }
  return activities[bestIdx];
}

function extractHotelName(allDays: any[], destination?: string | null): string | undefined {
  for (const day of allDays || []) {
    for (const a of day?.activities || []) {
      const venue = String(a?.venue_name || a?.venueName || '').trim();
      const cat = String(a?.category || '').toUpperCase();
      if (venue && venue.toLowerCase() !== 'your hotel' &&
          (cat === 'STAY' || cat === 'ACCOMMODATION')) {
        return venue;
      }
      const title = String(a?.title || a?.name || '');
      let m = title.match(/^Return to\s+(.+?)(?:\s*[—-]|$)/i);
      if (m && m[1] && m[1].toLowerCase() !== 'your hotel') return m[1].trim();
      m = title.match(/^Checkout from\s+\(?(.+?)\)?$/i);
      if (m && m[1]) return m[1].trim();
    }
  }
  return undefined;
}

export interface BookendTrace {
  expected: boolean;
  persisted: boolean;
  source: string;
  reason: string;
  injected: boolean;
  lastTitle: string;
  lastEnd: string | null;
  isDepartureDay: boolean;
}

/**
 * Run the verification + invariant + telemetry pass over every day.
 * Mutates `days` in place. Returns aggregate counters for logging.
 */
export async function runBookendVerification(
  days: any[],
  opts: { destination?: string | null; label?: string } = {},
): Promise<{
  scanned: number;
  expected: number;
  injected: number;
  persisted: number;
  missing: number;
  perDay: BookendTrace[];
}> {
  const label = opts.label || 'bookend-verify';
  const out: BookendTrace[] = [];
  let injected = 0;
  let persisted = 0;
  let expected = 0;
  let missing = 0;

  if (!Array.isArray(days) || days.length === 0) {
    return { scanned: 0, expected: 0, injected: 0, persisted: 0, missing: 0, perDay: [] };
  }

  // Identify the trip's true departure day: the last day whose chronological
  // tail is a flight / airport transfer. Otherwise the last day in the array.
  const lastIdx = days.length - 1;
  const tailLast = chronologicallyLast(days[lastIdx]?.activities || []);
  const departureDayIdx =
    tailLast && isDepartureTerminal(tailLast) ? lastIdx : lastIdx;
  const hotelName = extractHotelName(days, opts.destination);

  // Lazy-load runStep8 once.
  let runStep8: ((acts: any[], dayIndex: number, hotelName?: string) => void) | null = null;
  try {
    const mod = await import('../generate-itinerary/universal-quality-pass.ts');
    runStep8 = mod.runStep8;
  } catch (e) {
    console.warn(`[${label}] runStep8 import failed (non-blocking):`, e);
  }

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const activities: any[] = Array.isArray(day?.activities) ? day.activities : [];
    const isDepartureDay = i === departureDayIdx;

    let last = chronologicallyLast(activities);
    let lastTitle = String(last?.title || last?.name || '');
    let lastEnd =
      (last?.end_time as string | undefined) ||
      (last?.endTime as string | undefined) ||
      null;

    const dayExpects = !isDepartureDay && activities.length > 0 && !isDepartureTerminal(last);
    const alreadyPersisted = !!last && (
      isTrueReturn(last) ||
      BOOKEND_SOURCES.has(String(last?.source || '').toLowerCase())
    );

    let didInject = false;
    let reason = '';

    if (isDepartureDay) {
      reason = 'departure_day';
    } else if (!dayExpects && !alreadyPersisted) {
      reason = last && isDepartureTerminal(last) ? 'terminal_departure_logistics' : 'no_activities';
    } else if (alreadyPersisted) {
      reason = 'ok';
    } else {
      // Expected but missing → invariant pass.
      if (runStep8 && !isLockedRow(last)) {
        const before = activities.length;
        try {
          runStep8(activities, i, hotelName);
        } catch (e) {
          console.warn(`[${label}] runStep8 failed day=${i + 1} (non-blocking):`, e);
        }
        if (activities.length > before) {
          didInject = true;
          injected++;
          last = chronologicallyLast(activities);
          lastTitle = String(last?.title || last?.name || '');
          lastEnd =
            (last?.end_time as string | undefined) ||
            (last?.endTime as string | undefined) ||
            null;
          reason = 'injected_at_persist';
        } else {
          reason = 'runstep8_skipped';
        }
      } else {
        reason = runStep8 ? 'last_locked' : 'runstep8_unavailable';
      }
    }

    const finalPersisted = !!last && (
      isTrueReturn(last) ||
      BOOKEND_SOURCES.has(String(last?.source || '').toLowerCase())
    );

    if (dayExpects) {
      expected++;
      if (finalPersisted) persisted++;
      else missing++;
    }

    const trace: BookendTrace = {
      expected: dayExpects,
      persisted: finalPersisted,
      source: finalPersisted
        ? String(last?.source || '').toLowerCase() || 'inferred'
        : 'none',
      reason,
      injected: didInject,
      lastTitle,
      lastEnd,
      isDepartureDay,
    };
    out.push(trace);

    // Stamp on the day metadata so persisted JSON is auditable.
    day.metadata = day.metadata || {};
    day.metadata.quality = day.metadata.quality || {};
    day.metadata.quality.bookend_trace = trace;

    console.log(
      `[BOOKEND_VERIFY] day=${i + 1} expected=${dayExpects ? 1 : 0} ` +
      `persisted=${finalPersisted ? 1 : 0} injected=${didInject ? 1 : 0} ` +
      `source=${trace.source} reason=${reason} departure=${isDepartureDay ? 1 : 0} ` +
      `lastTitle="${lastTitle}" lastEnd=${lastEnd ?? 'null'}`,
    );
  }

  console.log(
    `[BOOKEND_VERIFY_SUMMARY] ${label} days=${days.length} expected=${expected} ` +
    `persisted=${persisted} injected=${injected} missing=${missing}`,
  );

  return {
    scanned: days.length,
    expected,
    injected,
    persisted,
    missing,
    perDay: out,
  };
}
