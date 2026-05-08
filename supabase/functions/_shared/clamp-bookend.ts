/**
 * Shared bookend clamp.
 *
 * Hotel-return / freshen-up / check-in cards are exempted from the 23:30
 * "drop past midnight" cutoff in three places (timing-cascade.ts and two
 * blocks in repair-day.ts). Without an upper clamp on `endTime`, a card that
 * starts at 23:45 with a 30–60 min duration ends past midnight and the UI
 * renders it as "12:44 AM" — a Day-N+1 bleed.
 *
 * This helper clamps `endTime` to LATEST_END (default 23:59) and shrinks
 * (or pulls back) the window so the card always lands inside the day.
 */

const HOTEL_BOOKEND_TITLE_RE =
  /\b(?:return\s+to|back\s+to|freshen[- ]?up|check[- ]?in|nightcap|wind[- ]?down|settle\s+in|retire|end[- ]of[- ]day)\b/i;

// Brand-aware hotel detection — catches "Walk to JW Marriott", "Shuttle to
// Cipriani", "Return to Aman Venice" etc. The bare-word "hotel" check misses
// every real branded hotel name. See plan.md §1.
const HOTEL_BRAND_RE =
  /\b(?:hotel|hostel|inn|resort|lodge|ryokan|riad|guesthouse|guest\s*house|b&b|jw\s*marriott|marriott|hilton|hyatt|park\s*hyatt|grand\s*hyatt|andaz|ritz[\-\s]?carlton|four\s*seasons|st\.?\s*regis|peninsula|aman|amanyara|amanjena|belmond|cipriani|gritti|danieli|metropole|bauer|kempinski|rosewood|mandarin\s*oriental|raffles|bvlgari|bulgari|conrad|edition|w\s+(?:hotel|venice|paris|rome|new\s*york)|sofitel|fairmont|shangri[\-\s]?la|intercontinental|le\s*meridien|westin|sheraton|nobu\s*hotel|nh\s*collection|melia|small\s*luxury|relais\s*&?\s*ch[âa]teaux)\b/i;

function isHotelLikeText(text: string, hotelName?: string | null): boolean {
  if (!text) return false;
  if (HOTEL_BRAND_RE.test(text)) return true;
  if (hotelName && hotelName.length >= 3) {
    const needle = hotelName.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (needle && text.toLowerCase().includes(needle)) return true;
  }
  return false;
}

const ACCOM_CATS = new Set(['accommodation', 'stay', 'hotel']);
const TRANSPORT_CATS = new Set(['transport', 'transportation']);

const LATEST_END_DEFAULT_MINS = 23 * 60 + 59; // 23:59
const MIN_VISIBLE_DURATION_MINS = 5;
const FALLBACK_WINDOW_MINS = 15;

export interface ClampBookendResult {
  changed: boolean;
  reason?: 'end_clamped' | 'start_pulled_back' | 'noop_not_bookend' | 'noop_in_bounds' | 'noop_no_times';
  beforeStart?: string;
  beforeEnd?: string;
  afterStart?: string;
  afterEnd?: string;
}

export interface ClampBookendOptions {
  /** Latest allowed `endTime` in minutes since midnight. Defaults to 23:59. */
  latestEndMins?: number;
  /** Optional context for log lines. */
  dayNumber?: number;
  label?: string;
  /** Trip-specific hotel name — enables matching even if no brand keyword. */
  hotelName?: string | null;
}

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

function minsToHHMM(mins: number): string {
  const m = Math.max(0, Math.min(mins, 23 * 60 + 59));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function isBookendCard(act: any): boolean {
  if (!act) return false;
  const cat = String(act.category || '').toLowerCase();
  const title = String(act.title || act.name || '').toLowerCase();
  const locName = String(act.location?.name || '').toLowerCase();

  if (ACCOM_CATS.has(cat) && HOTEL_BOOKEND_TITLE_RE.test(title)) return true;

  // Transport bookend (e.g. "Travel to Hotel", "Shuttle to JW Marriott")
  if (TRANSPORT_CATS.has(cat) && (title.includes('hotel') || locName.includes('hotel'))) return true;

  return false;
}

/**
 * Clamp a single bookend card's window to ≤ latestEnd. Mutates `act`.
 */
export function clampBookendEndTime(act: any, opts: ClampBookendOptions = {}): ClampBookendResult {
  if (!isBookendCard(act)) return { changed: false, reason: 'noop_not_bookend' };

  const latestEnd = opts.latestEndMins ?? LATEST_END_DEFAULT_MINS;

  const startStr = (act.startTime ?? act.start_time) as string | undefined;
  const endStr = (act.endTime ?? act.end_time) as string | undefined;

  let startMins = parseTimeMins(startStr);
  let endMins = parseTimeMins(endStr);

  if (startMins === null && endMins === null) {
    return { changed: false, reason: 'noop_no_times' };
  }

  // Detect midnight wrap (end < start) — treat as past-midnight bleed.
  const wrapped = startMins !== null && endMins !== null && endMins < startMins;

  const endIsOver = endMins !== null && (endMins > latestEnd || wrapped);
  if (!endIsOver && startMins !== null && startMins <= latestEnd) {
    return { changed: false, reason: 'noop_in_bounds' };
  }

  const beforeStart = startStr;
  const beforeEnd = endStr;

  // Step 1: clamp end to latestEnd.
  let newEnd = Math.min(latestEnd, endMins ?? latestEnd);
  if (wrapped || (endMins !== null && endMins > latestEnd)) newEnd = latestEnd;

  let newStart = startMins;
  let reason: ClampBookendResult['reason'] = 'end_clamped';

  // Step 2: ensure visible window. If shrunk under MIN_VISIBLE_DURATION_MINS,
  // pull start back to preserve a FALLBACK_WINDOW_MINS bookend.
  if (newStart !== null && newEnd - newStart < MIN_VISIBLE_DURATION_MINS) {
    newStart = Math.max(0, newEnd - FALLBACK_WINDOW_MINS);
    reason = 'start_pulled_back';
  }

  // If start was missing entirely, derive a 15-min window ending at latestEnd.
  if (newStart === null) {
    newStart = Math.max(0, newEnd - FALLBACK_WINDOW_MINS);
    reason = 'start_pulled_back';
  }

  const newStartStr = minsToHHMM(newStart);
  const newEndStr = minsToHHMM(newEnd);
  const newDur = Math.max(0, newEnd - newStart);

  // Mutate both casings since the rest of the pipeline mixes startTime / start_time.
  act.startTime = newStartStr;
  act.start_time = newStartStr;
  act.endTime = newEndStr;
  act.end_time = newEndStr;
  act.durationMinutes = newDur;
  if (typeof act.duration_minutes !== 'undefined') act.duration_minutes = newDur;

  const dayLabel = opts.dayNumber != null ? `day ${opts.dayNumber} ` : '';
  const tag = opts.label ? `[${opts.label}]` : '[BOOKEND_CLAMP]';
  console.warn(
    `${tag} ${dayLabel}clamped "${act.title}" from ${beforeStart}–${beforeEnd} to ${newStartStr}–${newEndStr} (${newDur}m, reason=${reason})`,
  );

  return {
    changed: true,
    reason,
    beforeStart,
    beforeEnd,
    afterStart: newStartStr,
    afterEnd: newEndStr,
  };
}

/**
 * Run `clampBookendEndTime` over every activity in the array. Returns the
 * number of cards that were actually clamped.
 */
export function clampAllBookends(
  activities: any[] | null | undefined,
  opts: ClampBookendOptions = {},
): number {
  if (!Array.isArray(activities) || activities.length === 0) return 0;
  let count = 0;
  for (const act of activities) {
    const res = clampBookendEndTime(act, opts);
    if (res.changed) count++;
  }
  return count;
}

export const __BOOKEND_INTERNALS = {
  HOTEL_BOOKEND_TITLE_RE,
  LATEST_END_DEFAULT_MINS,
  MIN_VISIBLE_DURATION_MINS,
  FALLBACK_WINDOW_MINS,
};
