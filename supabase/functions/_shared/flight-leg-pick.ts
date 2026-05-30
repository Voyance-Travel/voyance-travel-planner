/**
 * Edge-side leg picker. Thin wrapper over `normalize-flight-selection.ts`
 * (Deno port of `src/utils/normalizeFlightSelection.ts`) so the destination-
 * arrival / destination-departure leg the prompt + executioner trust matches
 * the leg the user actually saw in the FE editor.
 *
 * Behavioral contract (matches FE getDestinationArrivalLeg /
 * getDestinationDepartureLeg):
 *   1. Run normalizer → unified legs[] with `isDestinationArrival` /
 *      `isDestinationDeparture` auto-tagged when missing, return-leg arrival
 *      back-filled via outbound duration.
 *   2. Pick the marked leg (which after auto-tag is guaranteed to exist for
 *      every multi-leg shape).
 *
 * Returns the same `{ shape, source, leg, rawArrivalString,
 * rawDepartureString }` envelope the prior implementation did so
 * flight-hotel-context.ts and any other caller is unchanged.
 */

import {
  detectShape,
  normalizeFlightSelection,
  type FlightSelectionShape,
  type NormalizedLeg,
} from './normalize-flight-selection.ts';

export type { FlightSelectionShape } from './normalize-flight-selection.ts';

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
    | 'autotag_single_leg'
    | 'autotag_two_leg_outbound'
    | 'autotag_multi_leg'
    | 'autotag_last_leg'
    | 'normalize_failed'
    | 'none';
  leg?: PickedLeg;
  rawArrivalString?: string;
  rawDepartureString?: string;
}

function legToPicked(leg: NormalizedLeg | undefined): PickedLeg {
  if (!leg) return {};
  return {
    arrivalTime: leg.arrival?.time,
    departureTime: leg.departure?.time,
    arrivalAirport: leg.arrival?.airport,
    departureAirport: leg.departure?.airport,
  };
}

function classifySource(
  legs: NormalizedLeg[],
  pickedIdx: number,
  flag: 'isDestinationArrival' | 'isDestinationDeparture',
  userMarkerPresent: boolean,
): LegPickResult['source'] {
  if (userMarkerPresent) {
    return flag === 'isDestinationArrival'
      ? 'isDestinationArrival_flag'
      : 'isDestinationDeparture_flag';
  }
  if (legs.length === 1) return 'autotag_single_leg';
  if (legs.length === 2) {
    return flag === 'isDestinationArrival'
      ? 'autotag_two_leg_outbound'
      : 'autotag_last_leg';
  }
  return flag === 'isDestinationArrival' ? 'autotag_multi_leg' : 'autotag_last_leg';
}

export function pickDestinationArrivalLeg(raw: unknown): LegPickResult {
  const shape = detectShape(raw);
  if (shape === 'unknown' || !raw) return { shape, source: 'none' };

  // Detect whether the user marked the destination-arrival leg BEFORE we
  // hand off to the normalizer (which auto-tags on miss).
  const userMarker =
    shape === 'legs' &&
    Array.isArray((raw as any).legs) &&
    ((raw as any).legs as any[]).some((l) => l?.isDestinationArrival);

  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) {
    return { shape, source: 'normalize_failed' };
  }

  const idx = normalized.legs.findIndex((l) => l?.isDestinationArrival);
  const picked = idx >= 0 ? normalized.legs[idx] : normalized.legs[0];
  return {
    shape,
    source: classifySource(normalized.legs, idx, 'isDestinationArrival', userMarker),
    leg: legToPicked(picked),
    rawArrivalString: picked?.arrival?.time,
  };
}

export function pickDestinationDepartureLeg(raw: unknown): LegPickResult {
  const shape = detectShape(raw);
  if (shape === 'unknown' || !raw) return { shape, source: 'none' };

  const userMarker =
    shape === 'legs' &&
    Array.isArray((raw as any).legs) &&
    ((raw as any).legs as any[]).some((l) => l?.isDestinationDeparture);

  const normalized = normalizeFlightSelection(raw);
  if (!normalized || normalized.legs.length === 0) {
    return { shape, source: 'normalize_failed' };
  }

  const idx = normalized.legs.findIndex((l) => l?.isDestinationDeparture);
  const picked =
    idx >= 0 ? normalized.legs[idx] : normalized.legs[normalized.legs.length - 1];
  return {
    shape,
    source: classifySource(normalized.legs, idx, 'isDestinationDeparture', userMarker),
    leg: legToPicked(picked),
    rawDepartureString: picked?.departure?.time,
  };
}
