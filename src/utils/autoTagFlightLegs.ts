/**
 * Auto-tag flight legs as destination-arrival / destination-departure based
 * on direction. Stamps the flags only when they can be unambiguously inferred,
 * and NEVER overwrites a flag that the user (or upstream code) already set.
 *
 * Works on two shapes — picked at runtime per-leg:
 *   - Nested:  { arrival: { airport }, departure: { airport }, isDestination* }
 *   - Flat:    { arrivalAirport, departureAirport, isDestination* }
 *
 * Inference rules (in priority order):
 *   1. If ANY leg already has isDestinationArrival → leave arrival flags alone.
 *      Same for isDestinationDeparture.
 *   2. Single leg                  → mark arrival on leg 0.
 *   3. Two legs (round-trip)       → arrival on leg 0, departure on leg 1.
 *   4. 3+ legs WITH destIata hint  → arrival = leg whose arrival airport
 *                                   matches destIata; departure = LAST leg
 *                                   whose departure airport matches destIata.
 *   5. 3+ legs WITHOUT destIata    → arrival on legs.length-2 (second-to-last,
 *                                   matches getFirstLegArrivalTime heuristic),
 *                                   departure on last leg.
 *
 * Always enforces mutual exclusivity per flag.
 */

export interface AutoTagOptions {
  /** Final-destination IATA hint for 3+ leg disambiguation. */
  destinationIata?: string | null;
}

type LegLike = Record<string, any>;

function getArrivalAirport(leg: LegLike): string {
  return String(leg?.arrival?.airport ?? leg?.arrivalAirport ?? '').trim().toUpperCase();
}
function getDepartureAirport(leg: LegLike): string {
  return String(leg?.departure?.airport ?? leg?.departureAirport ?? '').trim().toUpperCase();
}

export function autoTagLegs<T extends LegLike>(
  legsIn: T[] | null | undefined,
  opts: AutoTagOptions = {},
): Array<T & { isDestinationArrival?: boolean; isDestinationDeparture?: boolean }> {
  type Tagged = T & { isDestinationArrival?: boolean; isDestinationDeparture?: boolean };
  if (!Array.isArray(legsIn) || legsIn.length === 0) return (legsIn ?? []) as Tagged[];
  // Shallow clone so we never mutate caller arrays
  const legs = legsIn.map((l) => ({ ...l })) as Tagged[];

  const anyArrivalSet = legs.some((l) => l?.isDestinationArrival === true);
  const anyDepartureSet = legs.some((l) => l?.isDestinationDeparture === true);
  const destIata = (opts.destinationIata || '').trim().toUpperCase();

  // ── Arrival pass ──
  if (!anyArrivalSet) {
    let arrivalIdx = -1;
    if (legs.length === 1) {
      arrivalIdx = 0;
    } else if (legs.length === 2) {
      arrivalIdx = 0;
    } else if (destIata) {
      // Prefer the first leg whose arrival airport matches the destination
      arrivalIdx = legs.findIndex((l) => getArrivalAirport(l) === destIata);
      if (arrivalIdx < 0) arrivalIdx = legs.length - 2; // fallback heuristic
    } else {
      arrivalIdx = legs.length - 2;
    }
    if (arrivalIdx >= 0 && arrivalIdx < legs.length) {
      legs[arrivalIdx] = { ...legs[arrivalIdx], isDestinationArrival: true };
    }
  }

  // ── Departure pass ──
  if (!anyDepartureSet) {
    let departureIdx = -1;
    if (legs.length === 1) {
      // one-way: no return leg, leave departure unset
      departureIdx = -1;
    } else if (legs.length === 2) {
      departureIdx = 1;
    } else if (destIata) {
      // LAST leg whose departure airport matches dest (handles multi-city)
      for (let i = legs.length - 1; i >= 0; i--) {
        if (getDepartureAirport(legs[i]) === destIata) {
          departureIdx = i;
          break;
        }
      }
      if (departureIdx < 0) departureIdx = legs.length - 1;
    } else {
      departureIdx = legs.length - 1;
    }
    if (departureIdx >= 0 && departureIdx < legs.length) {
      legs[departureIdx] = { ...legs[departureIdx], isDestinationDeparture: true };
    }
  }

  // ── Mutual exclusivity (preserve first-true wins per flag) ──
  let seenArr = false;
  let seenDep = false;
  for (let i = 0; i < legs.length; i++) {
    if (legs[i]?.isDestinationArrival) {
      if (seenArr) legs[i] = { ...legs[i], isDestinationArrival: false };
      else seenArr = true;
    }
    if (legs[i]?.isDestinationDeparture) {
      if (seenDep) legs[i] = { ...legs[i], isDestinationDeparture: false };
      else seenDep = true;
    }
  }

  return legs;
}

/**
 * Per-leg button-visibility helper for the editor UIs. Tells the renderer
 * which of the two mark-buttons make sense to show.
 *
 *   - Single leg                                → arrival only
 *   - 2 legs: leg 0 (outbound) → arrival only; leg 1 (return) → departure only
 *   - 3+ legs                                   → both shown (real ambiguity)
 */
export function legButtonVisibility(idx: number, totalLegs: number): {
  showArrival: boolean;
  showDeparture: boolean;
} {
  if (totalLegs <= 1) return { showArrival: true, showDeparture: false };
  if (totalLegs === 2) {
    return idx === 0
      ? { showArrival: true, showDeparture: false }
      : { showArrival: false, showDeparture: true };
  }
  return { showArrival: true, showDeparture: true };
}
