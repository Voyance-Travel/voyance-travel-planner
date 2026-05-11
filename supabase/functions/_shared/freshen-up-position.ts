/**
 * freshen-up-position — Deterministic post-pass that asserts the invariant:
 *   Every freshen-up / midday accommodation card MUST sit before the day's
 *   dinner card AND end at-or-before dinner.startTime − transit.
 *
 * Drops freshen-ups that landed after dinner (the taxi-to-hotel before dinner
 * already covers that ritual). Clamps freshen-ups that overlap dinner. Locked
 * cards are exempt.
 *
 * Wired at every persistence boundary: repair-day, universal-quality-pass,
 * and action-save-itinerary normalizeDays. Idempotent.
 */

export const FRESHEN_UP_RE =
  /\b(?:freshen[-\s]?up|luggage\s+drop|bag\s+drop|settle\s+in|drop\s+(?:bags|luggage))\b/i;

const TRUE_RETURN_RE = /\b(?:return\s+to|back\s+to|head\s+back\s+to|retire\s+to)\b/i;
const CHECKOUT_RE = /\b(?:check[-\s]?out|checkout|check[-\s]?in|checkin)\b/i;

const DINNER_RE = /\b(dinner|evening\s+meal)\b/i;
const HOTEL_TRANSPORT_HINT_RE = /\b(hotel|return\s+to|back\s+to|to\s+(?:the\s+)?(?:hotel|four\s+seasons|ritz|marriott|hilton|hyatt|aman|mandarin|peninsula|raffles|st\.?\s+regis|rosewood|bvlgari|fairmont|sofitel|conrad|edition))\b/i;

function parseHHMM(t: unknown): number | null {
  if (typeof t !== 'string') return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function toHHMM(mins: number): string {
  const h = Math.max(0, Math.min(23, Math.floor(mins / 60)));
  const m = Math.max(0, Math.min(59, mins % 60));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isFreshenUp(a: any): boolean {
  if (!a) return false;
  const title = String(a.title || a.name || '');
  if (!FRESHEN_UP_RE.test(title)) return false;
  // Genuine returns / checkouts / check-ins are NOT freshen-ups
  if (TRUE_RETURN_RE.test(title)) return false;
  if (CHECKOUT_RE.test(title)) return false;
  return true;
}

function isDinner(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toLowerCase();
  if (cat !== 'dining') return false;
  const title = String(a.title || a.name || '');
  return DINNER_RE.test(title);
}

function isHotelTransportBefore(a: any): boolean {
  if (!a) return false;
  const cat = String(a.category || '').toLowerCase();
  if (!/transport|transit|transfer/.test(cat)) return false;
  const title = String(a.title || '');
  const dest = String(a?.location?.name || '');
  return HOTEL_TRANSPORT_HINT_RE.test(title) || HOTEL_TRANSPORT_HINT_RE.test(dest);
}

function activityId(a: any): string {
  return String(a?.id ?? '');
}

export interface FreshenUpRepair {
  type: 'dropped_post_dinner' | 'clamped_into_dinner' | 'dropped_overlap_squeezed';
  activityId: string;
  before?: string;
  after?: string;
  message: string;
}

export interface FreshenUpOptions {
  dayNumber?: number;
  isFastPaced?: boolean;
  lockedIds?: Set<string>;
  /** Minutes between hotel and dinner; default 15 */
  hotelToDinnerMin?: number;
}

export interface FreshenUpResult<T> {
  activities: T[];
  repairs: FreshenUpRepair[];
  droppedIds: string[];
}

/**
 * Enforce: freshen-up cards sit before dinner AND end ≤ dinnerStart − transit.
 */
export function enforceFreshenUpPosition<T extends Record<string, any>>(
  input: T[],
  opts: FreshenUpOptions = {}
): FreshenUpResult<T> {
  const lockedIds = opts.lockedIds ?? new Set<string>();
  const hotelToDinnerMin = Math.max(0, opts.hotelToDinnerMin ?? 15);
  const repairs: FreshenUpRepair[] = [];
  const droppedIds: string[] = [];

  if (!Array.isArray(input) || input.length === 0) {
    return { activities: input ?? [], repairs, droppedIds };
  }

  const acts = [...input];

  // Find the day's terminal dinner (last dinner-titled dining card)
  let dinnerIdx = -1;
  for (let i = acts.length - 1; i >= 0; i--) {
    if (isDinner(acts[i])) { dinnerIdx = i; break; }
  }
  if (dinnerIdx < 0) {
    return { activities: acts, repairs, droppedIds };
  }
  const dinner = acts[dinnerIdx];
  const dinnerStart = parseHHMM(dinner.startTime ?? dinner.start_time);
  if (dinnerStart === null) {
    return { activities: acts, repairs, droppedIds };
  }

  // Was there a hotel-related transport before dinner within 120 min?
  let hadHotelTransportBeforeDinner = false;
  for (let i = 0; i < dinnerIdx; i++) {
    if (!isHotelTransportBefore(acts[i])) continue;
    const end = parseHHMM(acts[i].endTime ?? acts[i].end_time);
    if (end === null) { hadHotelTransportBeforeDinner = true; continue; }
    if (dinnerStart - end <= 180) { hadHotelTransportBeforeDinner = true; break; }
  }

  // Walk in reverse so splices don't reshuffle earlier indices
  for (let i = acts.length - 1; i >= 0; i--) {
    const a = acts[i];
    if (!isFreshenUp(a)) continue;
    const id = activityId(a);
    if (id && lockedIds.has(id)) continue;
    if (a.isLocked === true || a.locked === true || a.lock_state === 'locked') continue;

    const fStart = parseHHMM(a.startTime ?? a.start_time);
    const fEnd = parseHHMM(a.endTime ?? a.end_time);

    // Case A: freshen-up sits AFTER dinner in array order → drop.
    // Rationale: there's no narrative purpose for a freshen-up post-dinner,
    // and the taxi-to-hotel before dinner already covered the hotel arrival.
    if (i > dinnerIdx) {
      droppedIds.push(id);
      acts.splice(i, 1);
      repairs.push({
        type: 'dropped_post_dinner',
        activityId: id,
        before: `${a.title} @ ${a.startTime ?? a.start_time}`,
        message: `Day ${opts.dayNumber ?? '?'}: dropped freshen-up "${a.title}" — appears after dinner (no narrative purpose).`,
      });
      continue;
    }

    // Case B: freshen-up is array-before dinner but its time overlaps dinner.
    if (fStart !== null && fEnd !== null && fEnd > dinnerStart - hotelToDinnerMin) {
      const newEnd = dinnerStart - hotelToDinnerMin;
      const remaining = newEnd - fStart;
      if (remaining < 15) {
        // No room left — drop instead of squeeze
        droppedIds.push(id);
        acts.splice(i, 1);
        repairs.push({
          type: 'dropped_overlap_squeezed',
          activityId: id,
          before: `${a.title} @ ${a.startTime}-${a.endTime}`,
          message: `Day ${opts.dayNumber ?? '?'}: dropped freshen-up "${a.title}" — no room before dinner @ ${toHHMM(dinnerStart)}.`,
        });
        continue;
      }
      const before = `${a.title} @ ${a.startTime}-${a.endTime}`;
      const newEndStr = toHHMM(newEnd);
      (a as any).endTime = newEndStr;
      (a as any).end_time = newEndStr;
      (a as any).durationMinutes = remaining;
      repairs.push({
        type: 'clamped_into_dinner',
        activityId: id,
        before,
        after: `${a.title} @ ${a.startTime}-${a.endTime}`,
        message: `Day ${opts.dayNumber ?? '?'}: clamped freshen-up "${a.title}" endTime to ${newEndStr} (was overlapping dinner).`,
      });
    }
  }

  // Suppress hadHotelTransportBeforeDinner-only telemetry — kept for future logging if needed.
  void hadHotelTransportBeforeDinner;

  return { activities: acts, repairs, droppedIds };
}
