/**
 * Flight Selection Normalizer
 * 
 * Converts any flight_selection format (legacy {departure, return} or new {legs})
 * into a consistent legs[] array. All consumers should use this utility.
 */

import { autoTagLegs } from './autoTagFlightLegs';

export interface FlightLeg {
  legOrder: number;
  airline: string;
  flightNumber: string;
  departure: {
    airport: string;
    time: string;
    date: string;
  };
  arrival: {
    airport: string;
    time: string;
    date?: string;
    /** True when arrival.time was computed from outbound duration, not user-entered. */
    estimated?: boolean;
  };

  price: number;
  cabin: string;
  seatNumber?: string;
  confirmationCode?: string;
  terminal?: string;
  gate?: string;
  baggageInfo?: string;
  boardingPassUrl?: string;
  frequentFlyerNumber?: string;
  /** User-marked: this leg arrives at the final destination (used for Day 1 scheduling) */
  isDestinationArrival?: boolean;
  /** User-marked: this leg departs from the final destination (used for last day scheduling) */
  isDestinationDeparture?: boolean;
}

export interface NormalizedFlightSelection {
  legs: FlightLeg[];
  isManualEntry?: boolean;
  /** Total price across all legs */
  totalPrice: number;
}

/**
 * Normalize any flight_selection shape into a legs[] array.
 * Handles:
 * - New format: { legs: [...] }
 * - Legacy format: { departure: {...}, return: {...} }
 * - Flat format: { arrivalTime, departureAirport, ... }
 */
export function normalizeFlightSelection(raw: unknown): NormalizedFlightSelection | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;

  // Shared exit: run estimateReturnArrival + autoTagLegs and wrap.
  // BOTH the new-format and legacy branches must go through this — otherwise
  // legs[]-shaped inputs (what the setup form writes today) skip the estimator
  // and the return leg renders as "--:--".
  const finalize = (legs: FlightLeg[]): NormalizedFlightSelection | null => {
    if (legs.length === 0) return null;
    estimateReturnArrival(legs);
    const tagged = autoTagLegs(legs);
    return {
      legs: tagged,
      isManualEntry: data.isManualEntry as boolean | undefined,
      totalPrice: tagged.reduce((sum, l) => sum + (l.price || 0), 0),
    };
  };

  // New format: already has legs[]
  if (Array.isArray(data.legs) && data.legs.length > 0) {
    const legs = (data.legs as FlightLeg[]).map((leg, i) => ({
      ...leg,
      legOrder: leg.legOrder ?? i + 1,
    }));
    return finalize(legs);
  }

  // Legacy format: { departure: {...}, return: {...} }
  const legs: FlightLeg[] = [];

  const dep = data.departure as Record<string, unknown> | undefined;
  if (dep) {
    const depDeparture = dep.departure as Record<string, unknown> | undefined;
    const depArrival = dep.arrival as Record<string, unknown> | undefined;
    legs.push({
      legOrder: 1,
      airline: (dep.airline as string) || '',
      flightNumber: (dep.flightNumber as string) || '',
      departure: {
        airport: (depDeparture?.airport as string) || '',
        time: (depDeparture?.time as string) || '',
        date: (depDeparture?.date as string) || '',
      },
      arrival: {
        airport: (depArrival?.airport as string) || '',
        time: (depArrival?.time as string) || '',
        date: (depArrival?.date as string) || undefined,
      },
      price: (dep.price as number) || 0,
      cabin: (dep.cabin as string) || 'economy',
    });
  }

  const ret = data.return as Record<string, unknown> | undefined;
  if (ret) {
    const retDeparture = ret.departure as Record<string, unknown> | undefined;
    const retArrival = ret.arrival as Record<string, unknown> | undefined;
    legs.push({
      legOrder: 2,
      airline: (ret.airline as string) || '',
      flightNumber: (ret.flightNumber as string) || '',
      departure: {
        airport: (retDeparture?.airport as string) || '',
        time: (retDeparture?.time as string) || '',
        date: (retDeparture?.date as string) || '',
      },
      arrival: {
        airport: (retArrival?.airport as string) || '',
        time: (retArrival?.time as string) || '',
        date: (retArrival?.date as string) || undefined,
      },
      price: (ret.price as number) || 0,
      cabin: (ret.cabin as string) || 'economy',
    });
  }

  // Flat legacy format
  if (legs.length === 0 && (data.arrivalTime || data.departureAirport)) {
    legs.push({
      legOrder: 1,
      airline: '',
      flightNumber: '',
      departure: {
        airport: (data.departureAirport as string) || '',
        time: (data.departureTime as string) || '',
        date: '',
      },
      arrival: {
        airport: (data.arrivalAirport as string) || '',
        time: (data.arrivalTime as string) || '',
      },
      price: 0,
      cabin: 'economy',
    });
  }

  return finalize(legs);
}

/**
 * Parse a `YYYY-MM-DD` date plus `HH:MM` time into a UTC Date.
 * Returns null on any malformed input — never falls back to `new Date(str)`,
 * which is locale/timezone-dependent (see project date-parsing guidance).
 */
function parseDateTimeUTC(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!dm || !tm) return null;
  const y = +dm[1], mo = +dm[2], d = +dm[3];
  const h = +tm[1], mi = +tm[2];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== mo - 1) return null;
  return dt;
}

function fmtDateUTC(dt: Date): string {
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}
function fmtTimeUTC(dt: Date): string {
  return `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * If exactly two legs exist and the return leg has a departure time/date but no
 * arrival time, compute the return arrival from the outbound flight duration.
 * Same-airport round-trip assumption (true for ~all user-entered setup-form
 * flights). Marks the result as `estimated: true` so the UI can show "est.".
 * Idempotent: no-op when arrival.time is already populated.
 */
export function estimateReturnArrival(legs: FlightLeg[]): void {
  if (!Array.isArray(legs) || legs.length !== 2) return;
  const outbound = legs[0];
  const ret = legs[1];
  if (!outbound || !ret) return;
  if (ret.arrival?.time) return; // already populated, do not overwrite

  const outDep = parseDateTimeUTC(outbound.departure?.date, outbound.departure?.time);
  let outArr = parseDateTimeUTC(outbound.arrival?.date || outbound.departure?.date, outbound.arrival?.time);
  if (!outDep || !outArr) return;

  // Overnight inference: when the outbound has no explicit arrival.date and
  // the arrival time is at/before the departure time on the same fallback day,
  // treat the arrival as the next calendar day. Form-entered flights like
  // Dubai (08:00 → 06:00, no arr date) and Buenos Aires (08:00 → 09:00, no arr
  // date — actually overnight) would otherwise compute a negative or bogus
  // 1h duration and skip the return-arrival fill.
  if (!outbound.arrival?.date && outArr.getTime() <= outDep.getTime()) {
    outArr = new Date(outArr.getTime() + 24 * 60 * 60 * 1000);
  }

  const durationMin = (outArr.getTime() - outDep.getTime()) / 60000;
  if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 20 * 60) return;

  const retDep = parseDateTimeUTC(ret.departure?.date, ret.departure?.time);
  if (!retDep) return;

  const arrAt = new Date(retDep.getTime() + durationMin * 60000);
  ret.arrival = {
    ...(ret.arrival || { airport: '', time: '' }),
    airport: ret.arrival?.airport || '',
    time: fmtTimeUTC(arrAt),
    date: fmtDateUTC(arrAt),
    estimated: true,
  };
}


/**
 * Build the legacy-compatible flight_selection object from legs[].
 * This ensures backward compatibility with all existing consumers.
 */
export function buildFlightSelectionFromLegs(legsIn: FlightLeg[], isManualEntry = true): Record<string, unknown> {
  const legs = autoTagLegs(legsIn);
  const result: Record<string, unknown> = {
    legs,
    isManualEntry,
  };

  // Use the destination arrival leg for backward-compat "departure" field
  const destArrivalLeg = legs.find(l => l.isDestinationArrival) || (legs.length >= 1 ? legs[0] : undefined);
  if (destArrivalLeg) {
    result.departure = {
      airline: destArrivalLeg.airline,
      flightNumber: destArrivalLeg.flightNumber,
      departure: destArrivalLeg.departure,
      arrival: destArrivalLeg.arrival,
      price: destArrivalLeg.price,
      cabin: destArrivalLeg.cabin,
    };
  }

  if (legs.length >= 2) {
    // Prefer the leg explicitly marked as destination departure; fallback to last leg
    const destDepartureLeg = legs.find(l => l.isDestinationDeparture) || legs[legs.length - 1];
    result.return = {
      airline: destDepartureLeg.airline,
      flightNumber: destDepartureLeg.flightNumber,
      departure: destDepartureLeg.departure,
      arrival: destDepartureLeg.arrival,
      price: destDepartureLeg.price,
      cabin: destDepartureLeg.cabin,
    };
  }

  return result;
}

/**
 * Get the destination-arrival leg's arrival time (for Day 1 scheduling).
 * Prefers the leg explicitly marked isDestinationArrival by the user.
 * Falls back to the last outbound/connection leg (i.e. the leg that
 * actually lands at the destination, not a layover).
 */
export function getFirstLegArrivalTime(raw: unknown): string | undefined {
  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) return undefined;

  // 1. User-marked destination arrival leg
  const marked = normalized.legs.find(l => l.isDestinationArrival);
  if (marked?.arrival?.time) return marked.arrival.time;

  // 2. If there's only one leg, use it
  if (normalized.legs.length === 1) return normalized.legs[0].arrival.time || undefined;

  // 3. Heuristic: for multi-leg, use the last leg before a return leg.
  //    Return leg = last leg in the array for round-trips.
  //    For 2-leg trips (outbound + return), use leg 0.
  //    For 3+ legs, use the second-to-last (assumes last is return).
  if (normalized.legs.length === 2) {
    return normalized.legs[0].arrival.time || undefined;
  }
  // 3+ legs: assume last is return, second-to-last arrives at destination
  const destinationLeg = normalized.legs[normalized.legs.length - 2];
  return destinationLeg.arrival.time || undefined;
}

/**
 * Get the destination-departure leg's departure time (for last day scheduling).
 * Prefers the leg explicitly marked isDestinationDeparture by the user.
 * Falls back to the last leg (return flight).
 */
export function getLastLegDepartureTime(raw: unknown): string | undefined {
  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) return undefined;

  // 1. User-marked destination departure leg
  const marked = normalized.legs.find(l => l.isDestinationDeparture);
  if (marked?.departure?.time) return marked.departure.time;

  // 2. Default: last leg
  const lastLeg = normalized.legs[normalized.legs.length - 1];
  return lastLeg.departure.time || undefined;
}

/**
 * Get the leg that arrives at the final destination.
 * Used by FlightSyncWarning and cascade logic.
 */
export function getDestinationArrivalLeg(raw: unknown): FlightLeg | undefined {
  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) return undefined;

  const marked = normalized.legs.find(l => l.isDestinationArrival);
  if (marked) return marked;

  if (normalized.legs.length <= 2) return normalized.legs[0];
  return normalized.legs[normalized.legs.length - 2];
}
