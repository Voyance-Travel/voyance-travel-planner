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
const HOTEL_RETURN_RE =
  /(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\s+(?:your\s+|the\s+|our\s+)?[^,.\n]{0,80}(?:hotel|hostel|inn|resort|lodge|ryokan|riad|marriott|hilton|hyatt|ritz|four\s*seasons|st\.?\s*regis|peninsula|aman|belmond|cipriani|gritti|danieli|kempinski|rosewood|mandarin|raffles|bvlgari|bulgari|conrad|edition|sofitel|fairmont|shangri|intercontinental|westin|sheraton|nobu|notary|spadari)\b/i;
const BOOKEND_SOURCE_RE = /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;
const AIRPORT_RE = /\b(airport|station|terminal|gate)\b/i;
const TRANSPORT_CAT_RE = /TRANSPORT|TRANSIT|TRAVEL|LOGISTICS|FLIGHT/;
const FLIGHT_TITLE_RE = /\b(flight|departure)\b/i;
// Arrival-style flight/transfer titles must NOT be treated as departure
// terminals — Day 1 has an "Arrival Flight" + "Transfer to {hotel}" pair that
// would otherwise mark the day as a departure day and suppress the end-of-day
// hotel-return bookend (root cause of Osaka Day-1 nightcap with no return).
const ARRIVAL_TITLE_RE = /\b(arrival|inbound|landing|land\s+at|arrive)\b/i;
// Airport-bound transfer titles ("Transfer to KIX", "Taxi to JFK Terminal 4",
// "Drive to Heathrow") are unambiguous departure terminals even when the
// surrounding category is a generic 'transport' / 'TRAVEL'. Used as a
// secondary signal to `AIRPORT_RE` so the gray-zone branch never fabricates
// a 13:55 hotel-return after the airport drop-off.
const DEPARTURE_TRANSFER_TITLE_RE =
  /^\s*(?:transfer|taxi|drive|ride|shuttle|car|uber|lyft)\s+to\b[^.]*\b(airport|terminal|gate|station)\b/i;
// Trailing "for Check-in"/"for Checkout"/"for Arrival" clauses the AI sometimes
// glues onto otherwise-clean hotel names. Stripped after the main capture so
// the resolved hotel name never carries a half-word ("for Check") into the
// synthetic bookend title — root cause of the Osaka regression.
const TRAILING_CHECK_CLAUSE_RE =
  /\s+for\s+(?:check[-\s]?in|check[-\s]?out|checkin|checkout|arrival|departure)\b.*$/i;

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
  // Late-evening hotel check-in / settle-in / bag-drop IS the terminal
  // accommodation event (late arrival flights). Suppress duplicate bookend
  // when the card starts ≥ 20:00 and is a STAY/ACCOMMODATION card.
  if (MIDDAY_ACCOM_RE.test(title)) {
    const startMins = parseTime(a.startTime || a.start_time || a.time);
    if (startMins !== null && startMins >= 20 * 60 && (cat === 'STAY' || cat === 'ACCOMMODATION')) {
      return true;
    }
    return false;
  }
  // STAY / ACCOMMODATION cards count, except midday rituals (freshen-up,
  // bag drop, check-in) — same exclusion as runStep8.
  if (cat === 'STAY' || cat === 'ACCOMMODATION') return true;
  return false;
}

export function isHotelReturnBookendActivity(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toUpperCase();
  const title = String(a.title || a.name || '');
  const source = String(a.source || '').toLowerCase();
  const tags = Array.isArray(a.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
  if (MIDDAY_ACCOM_RE.test(title)) return false;
  if (BOOKEND_SOURCE_RE.test(source) || tags.some((t: string) => BOOKEND_SOURCE_RE.test(t))) return true;
  if (HOTEL_RETURN_RE.test(title)) return true;
  return (cat === 'STAY' || cat === 'ACCOMMODATION') && TRUE_RETURN_RE.test(title);
}

function isDepartureTerminal(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toUpperCase();
  const title = String(a.title || a.name || '');
  // Arrival flights / inbound transfers are NOT departure terminals.
  if (ARRIVAL_TITLE_RE.test(title)) return false;
  if (cat === 'FLIGHT' || FLIGHT_TITLE_RE.test(title)) return true;
  if (TRANSPORT_CAT_RE.test(cat) && AIRPORT_RE.test(title)) return true;
  // "Transfer to KIX", "Taxi to Heathrow Terminal 5" etc. — airport-bound
  // transfer titles are unambiguous departure terminals even when the
  // category is generic (e.g. 'transport'). Closes the Osaka regression
  // where the gray-zone branch fabricated a 13:55 hotel-return after the
  // departure-day airport drop-off.
  if (DEPARTURE_TRANSFER_TITLE_RE.test(title)) return true;
  // Hotel CHECKOUT is the unambiguous "we are leaving" anchor — even when the
  // airport transfer / departure flight is missing from the persisted JSON
  // (DB-vs-JSON divergence), a checkout card means the day MUST NOT receive
  // a synthetic "Return to {hotel}" injection. Closes Amsterdam/Osaka Day-3
  // 1:55 PM "wind down (overnight)" leak.
  if (CHECKOUT_RE.test(title)) return true;
  return false;
}

// Defense-in-depth: returns true when ANY card on the day signals a departure
// terminal. Used by the resolver to short-circuit when the chronologically
// last card isn't itself the airport transfer (e.g. a stale leisure card
// shifted past it by a manual edit).
function dayHasDepartureTerminal(activities: any[]): boolean {
  if (!Array.isArray(activities)) return false;
  return activities.some(isDepartureTerminal);
}


function cleanHotelName(raw: string): string {
  // Strip trailing "for Check-in"/"for Checkout"/etc. clauses then collapse
  // whitespace + trim residual punctuation. Returns '' when nothing usable
  // remains so callers fall back to 'Your Hotel'.
  return String(raw || '')
    .replace(TRAILING_CHECK_CLAUSE_RE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g, '')
    .trim();
}

function extractHotelName(allActivities: any[]): string | undefined {
  // Walk every activity across every day looking for a generator-injected
  // accommodation card that names the hotel. "Return to {X}", "Checkout from
  // {X}", or a STAY/ACCOMMODATION card whose venue_name / title carries it.
  //
  // IMPORTANT: only trust accommodation/STAY rows for venue extraction. The
  // AI sometimes mis-titles a transport leg "Return to {hotel} for Check-in"
  // — using that as a name source caused the Osaka truncation bug where the
  // bookend title became "Return to Four Seasons Hotel Osaka for Check"
  // (the prior non-greedy regex stopped at the first hyphen).
  for (const a of allActivities) {
    if (!a) continue;
    const cat = String(a.category || '').toUpperCase();
    const isAccom = cat === 'STAY' || cat === 'ACCOMMODATION';
    const venue = String(a.venue_name || a.venueName || '').trim();
    if (isAccom && venue && venue.toLowerCase() !== 'your hotel') {
      const cleaned = cleanHotelName(venue);
      if (cleaned) return cleaned;
    }
    if (!isAccom) continue;
    const title = String(a.title || a.name || '');
    // Capture everything after "Return to " up to a true separator
    // (em/en dash with surrounding spaces, comma, or end-of-string). Hyphens
    // inside the hotel name are preserved.
    let m = title.match(/^Return to\s+(.+?)(?:\s+[—–]\s+|,|$)/i);
    if (m && m[1]) {
      const cleaned = cleanHotelName(m[1]);
      if (cleaned && cleaned.toLowerCase() !== 'your hotel') return cleaned;
    }
    m = title.match(/^Checkout from\s+\(?(.+?)\)?(?:\s+[—–]\s+|,|$)/i);
    if (m && m[1]) {
      const cleaned = cleanHotelName(m[1]);
      if (cleaned) return cleaned;
    }
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
  // Defense in depth: if any card on this day is a flight/airport-transfer
  // terminal, treat as departure day even if caller forgot to pass the flag.
  if ((activities as any[]).some(isDepartureTerminal)) {
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=n/a reason=day_contains_departure_terminal`);
    return activities;
  }
  // NOTE: deliberately do NOT early-skip when the day already contains a
  // hotel-return card. A user-added late nightcap (or any post-generation
  // mutation that extends the day past an existing 20:15 "Return to Hotel")
  // must still trigger a fresh late-nightlife bookend. The wrap-aware
  // `lastIdx` walk + post-selection `isTerminalAlready(last)` check below
  // is the correct place to short-circuit — when the *chronologically*
  // last card is itself the hotel return, that branch returns. When a
  // nightcap end-time outranks the earlier return, we fall through and
  // append a second `late_nightlife_bookend` card. Closes recurring
  // "Day N nightcap with no following return" pattern (Casablanca /
  // Mallorca / San Juan).
  // [BOOKEND_TRACE] reason=stale_earlier_bookend_superseded is logged below
  // when this case fires.

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

  // If the day ALREADY has a true hotel-return bookend, only allow appending
  // a fresh one when the chronological tail genuinely EXTENDS the day past it
  // (e.g. a real nightcap that ends later than the existing bookend). A stale
  // "Walk to <hotel>" / "Transfer to <hotel>" connector with no real activity
  // after the original bookend MUST NOT trigger a second append — that was
  // the root cause of the Vienna Imperial Riding School duplicate where the
  // 0-min walk-connector after the 8:15 PM return tricked tail detection.
  const existingBookendEnd = (() => {
    let best = -1;
    for (const a of activities as any[]) {
      if (!isHotelReturnBookendActivity(a)) continue;
      const e = parseTime(a?.endTime) ?? parseTime(a?.end_time) ?? parseTime(a?.startTime) ?? parseTime(a?.start_time);
      if (e == null) continue;
      const rank = norm(e);
      if (rank > best) best = rank;
    }
    return best;
  })();
  if (existingBookendEnd >= 0) {
    const lastCat = String((last as any)?.category || '').toLowerCase();
    const lastTitle = String((last as any)?.title || (last as any)?.name || '');
    const isTransitConnector =
      /^transit|transport|logistics|travel$/i.test(lastCat) ||
      /^\s*(?:walk|stroll|transfer|taxi|drive|ride|shuttle|car|uber|lyft)\s+to\b/i.test(lastTitle);
    const tailExtendsBeyondBookend = norm(lastEndMins) > existingBookendEnd;
    if (isTransitConnector || !tailExtendsBeyondBookend) {
      // eslint-disable-next-line no-console
      console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=existing_bookend reason=${isTransitConnector ? 'tail_is_transit_connector' : 'tail_does_not_extend_past_bookend'} lastTitle="${lastTitle}" lastEnd=${fmt(lastEndMins)} bookendEnd=${fmt(existingBookendEnd % (24 * 60))}`);
      return activities;
    }
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=will_append source=stale_earlier_bookend_superseded lastTitle="${lastTitle}" lastEnd=${fmt(lastEndMins)}`);
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
      // eslint-disable-next-line no-console
      console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=n/a reason=postmidnight_not_nightlife lastEnd=${fmt(lastEndMins)}`);
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
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=skipped source=n/a reason=out_of_window lastEnd=${fmt(lastEndMins)}`);
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
  // eslint-disable-next-line no-console
  console.log(
    `[BOOKEND_TRACE] day=${(opts.dayIndex ?? 0) + 1} site=readtime action=injected source=${source} reason=ok startTime=${startTime} endTime=${endTime} lastEnd=${fmt(lastEndMins)}`,
  );

  return [...activities, card] as unknown as T;
}
