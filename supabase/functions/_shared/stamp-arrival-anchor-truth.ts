/**
 * stampArrivalAnchorTruth — single deterministic stamp of the Day-1
 * arrival-flight anchor card to the user's ground-truth arrival time.
 *
 * The integrity contract already detects `FLIGHT_ANCHOR_COMMIT_MISMATCH`
 * and `repair-day §3b` reconciles it best-effort, but neither owns the
 * value the moment the LLM response lands. This function does: it is
 * pure, idempotent, and safe to call from every post-LLM boundary
 * (validate, repair, executioner, commit-gate).
 *
 * Behavior:
 *   • No-op when `!isFirstDay`, `!arrivalTime24`, or `isHotelChange`.
 *   • Locate the arrival-flight card via multi-signal detector
 *     (anchorSource / tags / category+title regex).
 *   • Overwrite startTime/endTime to land at `arrivalTime24` for
 *     `airportProcessingMins` (default 45). Mirror across the legacy
 *     `start_time`/`end_time`/`time` aliases.
 *   • Stamp `isLocked=true`, `lockReason='flight-truth'`,
 *     `anchorSource='arrival-flight'`, `source='stamp-arrival-truth'`.
 *   • Preserve title/description/location/cost.
 *
 * Returns the (possibly mutated) day plus an action record for trace.
 *
 * See mem://constraints/itinerary/flight-anchor-truth-parity.md
 */

const DEFAULT_AIRPORT_PROCESSING_MINS = 45;

function parseHM(value: string): number | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function toHM(mins: number): string {
  const wrapped = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isArrivalFlightCard(a: any): boolean {
  if (!a || typeof a !== 'object') return false;
  const anchor = String(a.anchorSource || '').toLowerCase();
  if (anchor === 'arrival-flight') return true;
  const tags = Array.isArray(a.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
  if (tags.includes('arrival-flight')) return true;
  const cat = String(a.category || a.type || '').toLowerCase();
  const title = String(a.title || a.name || '').toLowerCase();
  if (cat === 'flight' || cat === 'transport' || cat === 'logistics') {
    if (
      title.includes('arrival flight') ||
      title.includes('landing') ||
      (title.includes('arrive') && title.includes('flight')) ||
      /\b(arrival|inbound)\b.*\bflight\b/.test(title)
    ) {
      return true;
    }
  }
  return false;
}

export interface StampArrivalTruthInput {
  isFirstDay: boolean;
  arrivalTime24?: string | null;
  arrivalAirport?: string | null;
  airportProcessingMins?: number;
  isHotelChange?: boolean;
}

export interface StampArrivalTruthResult {
  mutated: boolean;
  action:
    | 'noop_not_first_day'
    | 'noop_no_arrival_time'
    | 'noop_hotel_change'
    | 'noop_invalid_time'
    | 'noop_no_arrival_card'
    | 'noop_already_aligned'
    | 'overwrote_arrival_anchor';
  wasStart?: string | null;
  wasEnd?: string | null;
  newStart?: string;
  newEnd?: string;
  cardIndex?: number;
}

/**
 * Pure stamper. Mutates the activity in place when it finds one.
 * Returns the same `day` reference for convenient chaining.
 */
export function stampArrivalAnchorTruth(
  day: any,
  input: StampArrivalTruthInput,
): StampArrivalTruthResult {
  if (!input.isFirstDay) return { mutated: false, action: 'noop_not_first_day' };
  if (!input.arrivalTime24) return { mutated: false, action: 'noop_no_arrival_time' };
  if (input.isHotelChange) return { mutated: false, action: 'noop_hotel_change' };

  const arrivalMins = parseHM(String(input.arrivalTime24));
  if (arrivalMins === null) return { mutated: false, action: 'noop_invalid_time' };

  const acts = Array.isArray(day?.activities) ? day.activities : [];
  const idx = acts.findIndex(isArrivalFlightCard);
  if (idx === -1) return { mutated: false, action: 'noop_no_arrival_card' };

  const processingMins =
    typeof input.airportProcessingMins === 'number' && input.airportProcessingMins > 0
      ? input.airportProcessingMins
      : DEFAULT_AIRPORT_PROCESSING_MINS;

  const newStart = toHM(arrivalMins);
  const newEnd = toHM(arrivalMins + processingMins);

  const card = acts[idx];
  const wasStart = (card.startTime ?? card.start_time ?? card.time) as string | null | undefined;
  const wasEnd = (card.endTime ?? card.end_time) as string | null | undefined;

  // Already aligned (within the integrity contract's 10-min window)?
  const stampedMins =
    typeof wasStart === 'string' ? parseHM(wasStart) : null;
  if (
    stampedMins !== null &&
    Math.abs(stampedMins - arrivalMins) <= 0 &&
    card.isLocked === true &&
    String(card.lockReason || '') === 'flight-truth'
  ) {
    return {
      mutated: false,
      action: 'noop_already_aligned',
      wasStart: wasStart ?? null,
      wasEnd: wasEnd ?? null,
      newStart,
      newEnd,
      cardIndex: idx,
    };
  }

  card.startTime = newStart;
  card.start_time = newStart;
  card.time = newStart;
  card.endTime = newEnd;
  card.end_time = newEnd;
  card.durationMinutes = processingMins;
  card.isLocked = true;
  card.locked = true;
  card.lock_state = 'locked';
  card.lockReason = 'flight-truth';
  card.anchorSource = 'arrival-flight';
  card.source = 'stamp-arrival-truth';
  if (!card.title) card.title = 'Arrival Flight';
  if (!card.name) card.name = card.title;
  if (input.arrivalAirport && (!card.location || typeof card.location !== 'object')) {
    card.location = { name: input.arrivalAirport, address: '' };
  } else if (input.arrivalAirport && card.location && !card.location.name) {
    card.location.name = input.arrivalAirport;
  }

  return {
    mutated: true,
    action: 'overwrote_arrival_anchor',
    wasStart: wasStart ?? null,
    wasEnd: wasEnd ?? null,
    newStart,
    newEnd,
    cardIndex: idx,
  };
}

/**
 * Convenience helper for callers that have a `days[]` array but only
 * want to stamp the first day. Walks at most the first day and returns
 * the stamper result.
 */
export function stampArrivalAnchorTruthOnDays(
  days: any[],
  input: Omit<StampArrivalTruthInput, 'isFirstDay'>,
): StampArrivalTruthResult {
  if (!Array.isArray(days) || days.length === 0) {
    return { mutated: false, action: 'noop_not_first_day' };
  }
  return stampArrivalAnchorTruth(days[0], { ...input, isFirstDay: true });
}
