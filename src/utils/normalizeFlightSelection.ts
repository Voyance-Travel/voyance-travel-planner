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

  // Also write legacy departure/return for backward compat
  if (legs.length >= 1) {
    const first = legs[0];
    result.departure = {
      airline: first.airline,
      flightNumber: first.flightNumber,
      departure: first.departure,
      arrival: first.arrival,
      price: first.price,
      cabin: first.cabin,
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
 * Get the first leg's arrival time (for Day 1 scheduling)
 */
export function getFirstLegArrivalTime(raw: unknown): string | undefined {
  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) return undefined;
  return normalized.legs[0].arrival.time || undefined;
}

/**
 * Get the last leg's departure time (for last day scheduling)
 */
export function getLastLegDepartureTime(raw: unknown): string | undefined {
  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) return undefined;
  const lastLeg = normalized.legs[normalized.legs.length - 1];
  return lastLeg.departure.time || undefined;
}
