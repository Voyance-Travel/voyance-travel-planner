/**
 * Read-time hotel-return safety net.
 *
 * Mirrors `runStep8` (supabase/functions/generate-itinerary/universal-quality-pass.ts)
 * at display time so legacy trips and gray-zone end times still show a
 * "Return to {hotel}" card on every non-departure day.
 *
 * NEVER writes to DB. NEVER touches locked / user / manual / extracted / pinned
 * activities. Idempotent — short-circuits when the day already terminates on a
 * true hotel-return / checkout / STAY / accommodation card.
 *
 * Companion to `isGhostActivity` (src/lib/itinerary/hideGhostActivities.ts).
 *
 * Memory: mem://constraints/itinerary/read-time-hotel-return-bookend
 */

import { qualifiesAsLateNightlife } from './lateNightlifePredicate';

// — Same predicates as runStep8 (universal-quality-pass.ts:128–141) —
const TRUE_RETURN_RE =
  /\b(?:return\s+to|back\s+to|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\b/i;
const CHECKOUT_RE = /\b(?:check[-\s]?out|checkout)\b/i;
const MIDDAY_ACCOM_RE =
  /\b(?:freshen[-\s]?up|luggage\s+drop|bag\s+drop|settle\s+in|check[-\s]?in|drop\s+(?:bags|luggage))\b/i;
const AIRPORT_RE = /\b(airport|station|terminal|gate)\b/i;
const TRANSPORT_CAT_RE = /TRANSPORT|TRANSIT|TRAVEL|LOGISTICS|FLIGHT/;
const FLIGHT_TITLE_RE = /\b(flight|departure)\b/i;

function parseTime(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  return h * 60 + mm;
}

function fmt(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function isTerminalAlready(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toUpperCase();
  const title = String(a.title || a.name || '');
  // True return / checkout titles always count.
  if (TRUE_RETURN_RE.test(title) || CHECKOUT_RE.test(title)) return true;
  // STAY / ACCOMMODATION cards count, except midday rituals (freshen-up,
  // bag drop, check-in) — same exclusion as runStep8.
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

function extractHotelName(allActivities: any[]): string | undefined {
  // Walk every activity across every day looking for a generator-injected
  // accommodation card that names the hotel. "Return to {X}", "Checkout from
  // {X}", or a STAY/ACCOMMODATION card whose venue_name / title carries it.
  for (const a of allActivities) {
    if (!a) continue;
    const venue = String(a.venue_name || a.venueName || '').trim();
    if (venue && venue.toLowerCase() !== 'your hotel') {
      const cat = String(a.category || '').toUpperCase();
      if (cat === 'STAY' || cat === 'ACCOMMODATION') return venue;
    }
    const title = String(a.title || a.name || '');
    let m = title.match(/^Return to\s+(.+?)(?:\s*[—-]|$)/i);
    if (m && m[1] && m[1].toLowerCase() !== 'your hotel') return m[1].trim();
    m = title.match(/^Checkout from\s+\(?(.+?)\)?$/i);
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
}

export interface EnsureBookendOptions {
  /** When true, this day is the trip's departure day — never inject. */
  isDepartureDay?: boolean;
  /** Override for hotel name (from trip metadata). Falls back to extraction. */
  hotelName?: string;
  /** All activities across the whole trip — used to extract hotel name when absent. */
  allTripActivities?: any[];
  /** Day index (0-based). Used only for log sentinels. */
  dayIndex?: number;
}

/**
 * Returns a new array with a synthetic "Return to {hotel}" card appended when
 * appropriate. Returns the input untouched (same reference) when no injection
 * is needed.
 *
 * Lock semantics: locked / user / manual / extracted / pinned rows are NEVER
 * modified or reordered. They simply do not block appending a hotel return
 * after them — a user-added late dinner still terminates with a "Return to
 * {hotel}" card.
 */
export function ensureHotelReturnBookend<T extends any[]>(
  activities: T,
  opts: EnsureBookendOptions = {},
): T {
  if (!Array.isArray(activities) || activities.length === 0) return activities;
  if (opts.isDepartureDay) {
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=n/a reason=departure_day`);
    return activities;
  }

  // Identify the chronologically last activity by max end_time (fallback
  // start_time). Don't trust array order — the editor injects synthetic
  // transport / departure cards mid-stream and stale "Travel to <park>"
  // tails can survive past the day's true terminal anchor.
  //
  // Wrap-aware: times in [00:00, 05:59] are treated as the *following* day
  // so a 00:16 nightcap or a 02:50 cultural endpoint outranks an earlier
  // 21:00 dinner. Without this, the late-nightlife / overnight branches
  // below would never trigger when an earlier dinner exists.
  const WRAP_BOUNDARY = 6 * 60;
  const ONE_DAY = 24 * 60;
  const norm = (t: number) => (t < WRAP_BOUNDARY ? t + ONE_DAY : t);
  let lastIdx = -1;
  let lastTimeRaw = -1;
  let lastRank = -1;
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i] as any;
    const t =
      parseTime(a?.endTime) ??
      parseTime(a?.end_time) ??
      parseTime(a?.startTime) ??
      parseTime(a?.start_time);
    if (t == null) continue;
    const rank = norm(t);
    if (rank >= lastRank) {
      lastRank = rank;
      lastTimeRaw = t;
      lastIdx = i;
    }
  }

  // No times anywhere — fall back to array tail and let the synthesis logic
  // below decide.
  const last =
    lastIdx >= 0
      ? (activities[lastIdx] as any)
      : (activities[activities.length - 1] as any);
  if (!last) return activities;

  // Idempotency / departure-style guards. We deliberately do NOT skip on
  // user/manual/locked source — those rows just shouldn't be modified, but
  // the day still needs a hotel return.
  if (isTerminalAlready(last)) {
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=${String((last as any)?.source || 'inferred')} reason=already_terminal title="${String((last as any)?.title || '')}"`);
    return activities;
  }
  if (isDepartureTerminal(last)) {
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=n/a reason=departure_terminal title="${String((last as any)?.title || '')}"`);
    return activities;
  }

  const lastEndMins = lastTimeRaw >= 0 ? lastTimeRaw : null;
  if (lastEndMins === null) {
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=n/a reason=no_times`);
    return activities;
  }

  const hotel =
    (opts.hotelName && opts.hotelName.trim()) ||
    extractHotelName(opts.allTripActivities ?? (activities as any[])) ||
    '';
  const titleHotel = hotel || 'Your Hotel';

  // Choose start time + bookend variant based on which window the last
  // activity ends in.
  let startMins: number;
  let endMins: number;
  let source: 'bookend-readtime' | 'bookend-overnight';
  let description: string;
  let tags: string[];

  if (lastEndMins >= 14 * 60 && lastEndMins <= 23 * 60 + 59) {
    // Standard evening — clamp into [19:00, 23:30].
    startMins = Math.min(Math.max(lastEndMins + 15, 19 * 60), 23 * 60 + 30);
    endMins = Math.min(startMins + 25, 23 * 60 + 59);
    source = 'bookend-readtime';
    description = `Head back to ${titleHotel} for the night.`;
    tags = ['hotel', 'rest', 'bookend-readtime'];
  } else if (lastEndMins >= 0 && lastEndMins <= 2 * 60 + 30) {
    // Late-nightlife bleed — short taxi home, capped at 02:55. Use the
    // shared broadened predicate (vermutería/wine bar/taberna/etc. plus
    // time-anchored fallback start≥21:00).
    const lastStartMins =
      parseTime((last as any)?.startTime) ?? parseTime((last as any)?.start_time);
    if (!qualifiesAsLateNightlife(last, lastStartMins, lastEndMins)) {
      // 00:00–02:30 but not nightlife — don't fabricate; let it ship as-is.
      return activities;
    }
    startMins = Math.min(lastEndMins + 25, 2 * 60 + 55);
    endMins = Math.min(startMins + 25, 2 * 60 + 55);
    source = 'bookend-readtime';
    description = `Short taxi back to ${titleHotel} after a late night out.`;
    tags = ['hotel', 'rest', 'bookend-readtime', 'late_nightlife_bookend'];
  } else if (lastEndMins > 2 * 60 + 30 && lastEndMins < 14 * 60) {
    // Gray zone — unusual finish in the small hours or early morning. Anchor
    // 25 min after the last activity. Marked overnight so the card doesn't
    // pretend to be a normal evening return.
    startMins = lastEndMins + 25;
    endMins = startMins + 25;
    source = 'bookend-overnight';
    description = `Head back to ${titleHotel} to wind down (overnight).`;
    tags = ['hotel', 'rest', 'bookend-overnight'];
  } else {
    return activities;
  }

  const startTime = fmt(startMins);
  const endTime = fmt(endMins);

  const card = {
    id: `bookend-readtime-${opts.dayIndex ?? 0}-${startTime}`,
    title: hotel ? `Return to ${hotel}` : 'Return to Your Hotel',
    name: hotel ? `Return to ${hotel}` : 'Return to Your Hotel',
    venue_name: hotel || 'Your Hotel',
    venueName: hotel || 'Your Hotel',
    category: 'accommodation',
    startTime,
    start_time: startTime,
    endTime,
    end_time: endTime,
    cost: { amount: 0, currency: 'USD' },
    estimatedCost: { amount: 0, currency: 'USD' },
    cost_per_person: 0,
    price_per_person: 0,
    is_free: true,
    description,
    skipEnrichment: true,
    synthetic: true,
    source,
    tags,
  };

  // Sentinel for telemetry — matches the generator's [QUALITY] family.
  // eslint-disable-next-line no-console
  console.debug(
    `[QUALITY] day=${(opts.dayIndex ?? 0) + 1} read-time hotel-return appended (${source}, lastEnd=${fmt(lastEndMins)})`,
  );

  return [...activities, card] as unknown as T;
}
