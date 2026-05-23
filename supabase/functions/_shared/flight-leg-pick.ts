/**
 * Edge-fn-safe port of src/utils/normalizeFlightSelection.ts leg pickers.
 *
 * Single source of truth for picking the destination-arrival leg (Day 1
 * scheduling) and destination-departure leg (last day scheduling). Prefers
 * the user-marked `isDestinationArrival` / `isDestinationDeparture` flags,
 * falls back to the same heuristic the frontend uses so behavior matches
 * what the user saw in Step 2.
 */

export type FlightSelectionShape = 'legs' | 'legacy' | 'flat' | 'unknown';

export interface PickedLeg {
  arrivalTime?: string;
  departureTime?: string;
  arrivalAirport?: string;
  departureAirport?: string;
  isManual?: boolean;
}

export interface LegPickResult {
  shape: FlightSelectionShape;
  source:
    | 'isDestinationArrival_flag'
    | 'isDestinationDeparture_flag'
    | 'single_leg'
    | 'two_leg_outbound'
    | 'multi_leg_second_to_last'
    | 'legacy_departure_block'
    | 'legacy_return_block'
    | 'flat'
    | 'none';
  leg?: PickedLeg;
  rawArrivalString?: string;
  rawDepartureString?: string;
}

function detectShape(raw: unknown): FlightSelectionShape {
  if (!raw || typeof raw !== 'object') return 'unknown';
  const data = raw as Record<string, unknown>;
  if (Array.isArray(data.legs) && data.legs.length > 0) return 'legs';
  if (data.departure || data.return) return 'legacy';
  if (data.arrivalTime || data.departureAirport) return 'flat';
  return 'unknown';
}

/**
 * Pick the leg that arrives at the FINAL destination (used for Day 1 timing).
 */
export function pickDestinationArrivalLeg(raw: unknown): LegPickResult {
  const shape = detectShape(raw);
  if (shape === 'unknown' || !raw) return { shape, source: 'none' };

  const data = raw as Record<string, unknown>;

  // ── Legs[] shape ──
  if (shape === 'legs') {
    const legs = data.legs as Array<Record<string, any>>;
    const marked = legs.find((l) => l?.isDestinationArrival);
    if (marked) {
      return {
        shape,
        source: 'isDestinationArrival_flag',
        leg: legToPicked(marked),
        rawArrivalString: marked?.arrival?.time,
      };
    }
    if (legs.length === 1) {
      return {
        shape,
        source: 'single_leg',
        leg: legToPicked(legs[0]),
        rawArrivalString: legs[0]?.arrival?.time,
      };
    }
    if (legs.length === 2) {
      // Outbound + return: leg 0 lands at destination
      return {
        shape,
        source: 'two_leg_outbound',
        leg: legToPicked(legs[0]),
        rawArrivalString: legs[0]?.arrival?.time,
      };
    }
    // 3+ legs: assume last is return, second-to-last lands at destination
    const idx = legs.length - 2;
    return {
      shape,
      source: 'multi_leg_second_to_last',
      leg: legToPicked(legs[idx]),
      rawArrivalString: legs[idx]?.arrival?.time,
    };
  }

  // ── Legacy { departure: {...}, return: {...} } shape ──
  if (shape === 'legacy') {
    const dep = data.departure as Record<string, any> | undefined;
    const arrTime =
      dep?.arrival?.time ??
      dep?.arrivalTime ??
      (data.arrivalTime as string | undefined);
    const arrAirport =
      dep?.arrival?.airport ?? (data.arrivalAirport as string | undefined);
    const depAirport =
      dep?.departure?.airport ?? (data.departureAirport as string | undefined);
    return {
      shape,
      source: 'legacy_departure_block',
      leg: {
        arrivalTime: arrTime as string | undefined,
        arrivalAirport: arrAirport as string | undefined,
        departureAirport: depAirport as string | undefined,
        isManual: Boolean(data.isManualEntry),
      },
      rawArrivalString: arrTime as string | undefined,
    };
  }

  // ── Flat shape ──
  return {
    shape,
    source: 'flat',
    leg: {
      arrivalTime: data.arrivalTime as string | undefined,
      arrivalAirport: data.arrivalAirport as string | undefined,
      departureAirport: data.departureAirport as string | undefined,
    },
    rawArrivalString: data.arrivalTime as string | undefined,
  };
}

/**
 * Pick the leg that DEPARTS the final destination (used for last day timing).
 */
export function pickDestinationDepartureLeg(raw: unknown): LegPickResult {
  const shape = detectShape(raw);
  if (shape === 'unknown' || !raw) return { shape, source: 'none' };

  const data = raw as Record<string, unknown>;

  if (shape === 'legs') {
    const legs = data.legs as Array<Record<string, any>>;
    const marked = legs.find((l) => l?.isDestinationDeparture);
    if (marked) {
      return {
        shape,
        source: 'isDestinationDeparture_flag',
        leg: legToPicked(marked),
        rawDepartureString: marked?.departure?.time,
      };
    }
    // Default: last leg is the return flight
    const last = legs[legs.length - 1];
    return {
      shape,
      source: legs.length === 1 ? 'single_leg' : 'multi_leg_second_to_last',
      leg: legToPicked(last),
      rawDepartureString: last?.departure?.time,
    };
  }

  if (shape === 'legacy') {
    const ret = data.return as Record<string, any> | undefined;
    const depTime =
      ret?.departure?.time ??
      ret?.departureTime ??
      (data.returnDepartureTime as string | undefined);
    return {
      shape,
      source: 'legacy_return_block',
      leg: {
        departureTime: depTime as string | undefined,
        departureAirport: ret?.departure?.airport,
        arrivalAirport: ret?.arrival?.airport,
      },
      rawDepartureString: depTime as string | undefined,
    };
  }

  return { shape, source: 'flat', leg: {} };
}

function legToPicked(leg: Record<string, any> | undefined): PickedLeg {
  if (!leg) return {};
  return {
    arrivalTime: leg?.arrival?.time,
    departureTime: leg?.departure?.time,
    arrivalAirport: leg?.arrival?.airport,
    departureAirport: leg?.departure?.airport,
  };
}
