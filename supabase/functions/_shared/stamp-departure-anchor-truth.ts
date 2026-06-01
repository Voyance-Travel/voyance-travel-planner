/**
 * stampDepartureAnchorTruth — single deterministic stamp of the last-day
 * departure-flight anchor card to the user's ground-truth departure time.
 *
 * Mirror of `stamp-arrival-anchor-truth.ts`. The LLM frequently invents a
 * pre-dawn (e.g. 01:35 AM) "Departure Flight" card that starves the meal
 * repair logic on the final day. This function overwrites the card's time
 * to the real `returnDepartureTime24`, freeing the day for breakfast /
 * lunch / pre-departure dinner injection.
 *
 * Behavior:
 *   • No-op when `!isLastDay`, `!departureTime24`, or invalid HH:MM.
 *   • Locate the departure-flight card via multi-signal detector
 *     (anchorSource / tags / category+title regex).
 *   • Overwrite startTime = depTime − boardingLeadMins (boarding gate)
 *     and endTime = depTime (wheels-up). Mirror legacy aliases.
 *   • Stamp `isLocked=true`, `lockReason='flight-truth'`,
 *     `anchorSource='departure-flight'`, `source='stamp-departure-truth'`.
 *   • Preserve title/description/location/cost.
 *
 * See mem://constraints/itinerary/flight-anchor-truth-parity.md
 */

const DEFAULT_BOARDING_LEAD_MINS = 45;

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

export function isDepartureFlightCard(a: any): boolean {
  if (!a || typeof a !== 'object') return false;
  const anchor = String(a.anchorSource || '').toLowerCase();
  if (anchor === 'departure-flight') return true;
  const tags = Array.isArray(a.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
  if (tags.includes('departure-flight')) return true;
  const cat = String(a.category || a.type || '').toLowerCase();
  const title = String(a.title || a.name || '').toLowerCase();
  if (cat === 'flight' || cat === 'transport' || cat === 'logistics') {
    if (
      title.includes('departure flight') ||
      title.includes('flight home') ||
      title.includes('return flight') ||
      title.includes('outbound flight') ||
      /\b(depart|return|outbound|home)\b.*\bflight\b/.test(title) ||
      /\bboard(ing)?\b.*\bflight\b/.test(title)
    ) {
      return true;
    }
    // Bare "Flight" on the last day with no other anchor is almost always
    // the departure card — accept it so we don't leave a 01:35 ghost.
    if (cat === 'flight' && /^\s*flight\s*$/i.test(title)) return true;
  }
  return false;
}

export interface StampDepartureTruthInput {
  isLastDay: boolean;
  departureTime24?: string | null;
  departureAirport?: string | null;
  boardingLeadMins?: number;
}

export interface StampDepartureTruthResult {
  mutated: boolean;
  action:
    | 'noop_not_last_day'
    | 'noop_no_departure_time'
    | 'noop_invalid_time'
    | 'noop_no_departure_card'
    | 'noop_already_aligned'
    | 'overwrote_departure_anchor';
  wasStart?: string | null;
  wasEnd?: string | null;
  newStart?: string;
  newEnd?: string;
  cardIndex?: number;
}

export function stampDepartureAnchorTruth(
  day: any,
  input: StampDepartureTruthInput,
): StampDepartureTruthResult {
  if (!input.isLastDay) return { mutated: false, action: 'noop_not_last_day' };
  if (!input.departureTime24) return { mutated: false, action: 'noop_no_departure_time' };

  const depMins = parseHM(String(input.departureTime24));
  if (depMins === null) return { mutated: false, action: 'noop_invalid_time' };

  const acts = Array.isArray(day?.activities) ? day.activities : [];
  const idx = acts.findIndex(isDepartureFlightCard);
  if (idx === -1) return { mutated: false, action: 'noop_no_departure_card' };

  const leadMins =
    typeof input.boardingLeadMins === 'number' && input.boardingLeadMins > 0
      ? input.boardingLeadMins
      : DEFAULT_BOARDING_LEAD_MINS;

  const newStart = toHM(depMins - leadMins);
  const newEnd = toHM(depMins);

  const card = acts[idx];
  const wasStart = (card.startTime ?? card.start_time ?? card.time) as string | null | undefined;
  const wasEnd = (card.endTime ?? card.end_time) as string | null | undefined;

  const stampedMins = typeof wasStart === 'string' ? parseHM(wasStart) : null;
  if (
    stampedMins !== null &&
    stampedMins === depMins - leadMins &&
    card.isLocked === true &&
    String(card.lockReason || '') === 'flight-truth' &&
    String(card.anchorSource || '') === 'departure-flight'
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
  card.durationMinutes = leadMins;
  card.duration = `${leadMins}m`;
  card.isLocked = true;
  card.locked = true;
  card.lock_state = 'locked';
  card.lockReason = 'flight-truth';
  card.anchorSource = 'departure-flight';
  card.source = 'stamp-departure-truth';
  if (!card.title) card.title = 'Departure Flight';
  if (!card.name) card.name = card.title;
  if (input.departureAirport && (!card.location || typeof card.location !== 'object')) {
    card.location = { name: input.departureAirport, address: '' };
  } else if (input.departureAirport && card.location && !card.location.name) {
    card.location.name = input.departureAirport;
  }

  return {
    mutated: true,
    action: 'overwrote_departure_anchor',
    wasStart: wasStart ?? null,
    wasEnd: wasEnd ?? null,
    newStart,
    newEnd,
    cardIndex: idx,
  };
}

/**
 * Convenience helper for callers with a `days[]` array — stamps the last day.
 */
export function stampDepartureAnchorTruthOnDays(
  days: any[],
  input: Omit<StampDepartureTruthInput, 'isLastDay'>,
): StampDepartureTruthResult {
  if (!Array.isArray(days) || days.length === 0) {
    return { mutated: false, action: 'noop_not_last_day' };
  }
  return stampDepartureAnchorTruth(days[days.length - 1], { ...input, isLastDay: true });
}
