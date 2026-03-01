/**
 * Flight Selection Normalizer
 * 
 * Converts any flight_selection format (legacy {departure, return} or new {legs})
 * into a consistent legs[] array. All consumers should use this utility.
 */

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

  // New format: already has legs[]
  if (Array.isArray(data.legs) && data.legs.length > 0) {
    const legs = (data.legs as FlightLeg[]).map((leg, i) => ({
      ...leg,
      legOrder: leg.legOrder ?? i + 1,
    }));
    return {
      legs,
      isManualEntry: data.isManualEntry as boolean | undefined,
      totalPrice: legs.reduce((sum, l) => sum + (l.price || 0), 0),
    };
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

  if (legs.length === 0) return null;

  return {
    legs,
    isManualEntry: data.isManualEntry as boolean | undefined,
    totalPrice: legs.reduce((sum, l) => sum + (l.price || 0), 0),
  };
}

/**
 * Build the legacy-compatible flight_selection object from legs[].
 * This ensures backward compatibility with all existing consumers.
 */
export function buildFlightSelectionFromLegs(legs: FlightLeg[], isManualEntry = true): Record<string, unknown> {
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
    const last = legs[legs.length - 1];
    result.return = {
      airline: last.airline,
      flightNumber: last.flightNumber,
      departure: last.departure,
      arrival: last.arrival,
      price: last.price,
      cabin: last.cabin,
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
