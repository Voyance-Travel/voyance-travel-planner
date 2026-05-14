/**
 * Departure-day untimed-row prune.
 *
 * Mirrors the server-side §15z pruner in
 * `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
 * (`enforceDepartureDayLogistics`) — drops any non-logistics, non-locked,
 * non-userAdded card on the trip's departure day whose `startTime` /
 * `start_time` / `time` is missing or unparseable.
 *
 * Why it exists at the client + parser layer:
 *   §15z only runs in 4 backend persist boundaries (action-save-itinerary
 *   STEP 2.65, repair-day, chain finalizer, action-sync-tables). Chat-action
 *   sub-paths, optimistic patches, undo/redo, and legacy already-persisted
 *   trips can land an untimed dining row that surfaces as a "floating Lunch"
 *   after the airport transfer. This module is the single boundary used by
 *   both `safeUpdateItineraryData` (persist-time) and `parseItineraryDays`
 *   (read-time) so the two layers stay in lockstep.
 *
 * See mem://constraints/itinerary/departure-day-untimed-defense
 */

const TIME_RE = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*(am|pm)?\s*$/i;

function parseStartMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = TIME_RE.exec(value);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const suffix = m[3]?.toLowerCase();
  if (suffix === 'am') {
    if (h === 12) h = 0;
  } else if (suffix === 'pm') {
    if (h !== 12) h += 12;
  }
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function pickStartMinutes(a: any): number | null {
  if (!a) return null;
  return (
    parseStartMinutes(a.startTime) ??
    parseStartMinutes(a.start_time) ??
    parseStartMinutes(a.time)
  );
}

function isLockedOrUserOwned(a: any): boolean {
  if (!a) return false;
  if (a.is_locked === true || a.isLocked === true || a.locked === true) return true;
  if (a.lock_state === 'locked') return true;
  if (a.userAdded || a.userEdited || a.isManual || a.extracted || a.pinned) return true;
  const src = String(a.source || '').toLowerCase();
  if (['user', 'manual', 'extracted', 'pinned'].includes(src)) return true;
  return false;
}

const LOGISTICS_CAT_RE = /\b(transport|transit|travel|logistics|flight|accommodation|stay|checkout|airport|transfer)\b/i;
const LOGISTICS_TITLE_RE =
  /\b(check[-\s]?out|airport|terminal|gate|station|flight|transfer\s+to|departure|boarding|baggage|luggage|bag\s+drop)\b/i;
const RETURN_HOTEL_TITLE_RE = /^\s*(?:return|head\s+back|wind\s+down)\b/i; // hotel-return bookends
const FRESHEN_UP_TITLE_RE = /\b(freshen\s+up|midday\s+(?:break|rest))\b/i;

function isLogisticsRow(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || a.type || '').toLowerCase();
  if (LOGISTICS_CAT_RE.test(cat)) return true;
  const title = String(a.title || a.name || '');
  if (LOGISTICS_TITLE_RE.test(title)) return true;
  if (RETURN_HOTEL_TITLE_RE.test(title)) return true;
  if (FRESHEN_UP_TITLE_RE.test(title)) return true;
  const src = String(a.source || '').toLowerCase();
  if (/^bookend|hotel_return|late_nightlife/.test(src)) return true;
  const subcat = String(a.subcategory || '').toLowerCase();
  if (subcat === 'airport_transfer') return true;
  return false;
}

export interface PruneDepartureUntimedResult<T> {
  activities: T[];
  droppedTitles: string[];
}

/**
 * Strip untimed, non-logistics, non-locked, non-userAdded cards from a
 * departure-day activity list. Pure function — caller decides whether the
 * day is a departure day and whether to apply the result.
 */
export function pruneDepartureUntimed<T = any>(
  activities: T[] | null | undefined,
): PruneDepartureUntimedResult<T> {
  const list = Array.isArray(activities) ? activities : [];
  const dropped: string[] = [];
  const kept: T[] = [];
  for (const a of list) {
    if (isLogisticsRow(a)) {
      kept.push(a);
      continue;
    }
    if (isLockedOrUserOwned(a)) {
      kept.push(a);
      continue;
    }
    const start = pickStartMinutes(a);
    if (start === null) {
      const title = String((a as any)?.title || (a as any)?.name || '(unnamed)');
      dropped.push(title);
      continue;
    }
    kept.push(a);
  }
  return { activities: kept, droppedTitles: dropped };
}

const DEPARTURE_TERMINAL_TITLE_RE =
  /^\s*(?:transfer|taxi|drive|ride|shuttle|car|uber|lyft)\s+to\b[^.]*\b(airport|terminal|gate|station)\b/i;
const ARRIVAL_TITLE_RE = /\b(arrival|inbound|landing|land\s+at|arrive)\b/i;
const FLIGHT_TITLE_RE = /\b(flight|departure)\b/i;
const TRANSPORT_CAT_RE = /TRANSPORT|TRANSIT|TRAVEL|LOGISTICS/;
const TRANSPORT_HUB_TITLE_RE = /\b(airport|terminal|gate|station)\b/i;
const CHECKOUT_TITLE_RE = /\b(?:check[-\s]?out|checkout)\b/i;

function dayHasDepartureTerminal(activities: any[]): boolean {
  return (activities || []).some((a) => {
    const title = String(a?.title || a?.name || '');
    if (ARRIVAL_TITLE_RE.test(title)) return false;
    const cat = String(a?.category || '').toUpperCase();
    if (cat === 'FLIGHT' || FLIGHT_TITLE_RE.test(title)) return true;
    if (TRANSPORT_CAT_RE.test(cat) && TRANSPORT_HUB_TITLE_RE.test(title)) return true;
    if (DEPARTURE_TERMINAL_TITLE_RE.test(title)) return true;
    if (CHECKOUT_TITLE_RE.test(title)) return true;
    return false;
  });
}

/**
 * Find the departure-day index in a `days` array (last day with a flight /
 * airport transfer / checkout signal; falls back to the last day for
 * multi-day trips). Mirrors the parser's detector so callers don't need
 * to duplicate the logic.
 */
export function detectDepartureDayIdx(
  days: Array<{ activities?: any[] }> | null | undefined,
): number {
  if (!Array.isArray(days) || days.length === 0) return -1;
  for (let i = days.length - 1; i >= 0; i--) {
    if (dayHasDepartureTerminal(days[i]?.activities || [])) return i;
  }
  return days.length > 1 ? days.length - 1 : -1;
}
