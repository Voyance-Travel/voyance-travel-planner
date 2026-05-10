/**
 * recomputeDayModes
 *
 * When `flight_selection` changes after itinerary generation, the cached
 * `metadata.quality.{dayMode, meal_policy_at_generation}` on each day is stale.
 * The health engine reads `dayMode` to decide which meals to require, so a
 * post-generation flight add/edit silently misses missing-meal warnings on the
 * actual arrival/departure days.
 *
 * This helper re-derives the meal policy for Day 1 (arrival) and the last day
 * (departure) from the current flight_selection and writes the result back to
 * each day's metadata. Days with `metadata.quality.dayMode_locked === true` are
 * never overwritten.
 */

import { deriveMealPolicy } from './deriveMealPolicy';

interface Leg {
  airline?: string;
  flightNumber?: string;
  departure?: { time?: string; airport?: string };
  arrival?: { time?: string; airport?: string };
  isDestinationArrival?: boolean;
  isDestinationDeparture?: boolean;
}

interface FlightSelection {
  legs?: Leg[];
  departure?: { arrival?: { time?: string } };
  return?: { departure?: { time?: string } };
}

function to24h(t: string | undefined | null): string | undefined {
  if (!t) return undefined;
  const s = String(t).trim().toUpperCase();
  const m24 = s.match(/^(\d{1,2}):(\d{2})/);
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1]);
    const mm = m12[2];
    if (m12[3] === 'PM' && h !== 12) h += 12;
    if (m12[3] === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${mm}`;
  }
  if (m24) {
    return `${String(parseInt(m24[1])).padStart(2, '0')}:${m24[2]}`;
  }
  return undefined;
}

export function extractArrivalDeparture24(
  flightSelection: FlightSelection | null | undefined
): { arrivalTime24?: string; departureTime24?: string } {
  if (!flightSelection) return {};
  const legs = Array.isArray(flightSelection.legs) ? flightSelection.legs : [];

  let arrivalLeg: Leg | undefined;
  let departureLeg: Leg | undefined;

  if (legs.length > 0) {
    arrivalLeg = legs.find((l) => l.isDestinationArrival) || legs[0];
    if (legs.length >= 2) {
      departureLeg = legs.find((l) => l.isDestinationDeparture) || legs[legs.length - 1];
    }
  }

  const arrivalTime24 =
    to24h(arrivalLeg?.arrival?.time) ||
    to24h(flightSelection.departure?.arrival?.time);
  const departureTime24 =
    to24h(departureLeg?.departure?.time) ||
    to24h(flightSelection.return?.departure?.time);

  return { arrivalTime24, departureTime24 };
}

export interface RecomputeResult {
  updatedDays: any[];
  changed: boolean;
  changedDayNumbers: number[];
}

export function recomputeDayModes(
  days: any[] | undefined | null,
  flightSelection: FlightSelection | null | undefined,
): RecomputeResult {
  if (!Array.isArray(days) || days.length === 0) {
    return { updatedDays: days || [], changed: false, changedDayNumbers: [] };
  }

  const { arrivalTime24, departureTime24 } = extractArrivalDeparture24(flightSelection);
  const totalDays = days.length;
  const changedDayNumbers: number[] = [];

  const updatedDays = days.map((day, i) => {
    const dayNumber = day?.dayNumber || i + 1;
    const isFirstDay = dayNumber === 1;
    const isLastDay = dayNumber === totalDays;

    // Only Day 1 and last day are affected by flight times; mid-trip days
    // remain untouched (transition/full-day-event flags are out of scope here).
    if (!isFirstDay && !isLastDay) return day;

    if (day?.metadata?.quality?.dayMode_locked === true) return day;

    const policy = deriveMealPolicy({
      dayNumber,
      totalDays,
      isFirstDay,
      isLastDay,
      arrivalTime24: isFirstDay ? arrivalTime24 : undefined,
      departureTime24: isLastDay ? departureTime24 : undefined,
    });

    const prevMode = day?.metadata?.quality?.dayMode;
    if (prevMode === policy.dayMode) {
      // Still write meal_policy_at_generation if missing/stale, but skip change flag.
      const existingCached = day?.metadata?.quality?.meal_policy_at_generation;
      if (existingCached?.dayMode === policy.dayMode &&
          Array.isArray(existingCached?.requiredMeals) &&
          existingCached.requiredMeals.length === policy.requiredMeals.length) {
        return day;
      }
    } else {
      changedDayNumbers.push(dayNumber);
    }

    return {
      ...day,
      metadata: {
        ...(day?.metadata || {}),
        quality: {
          ...(day?.metadata?.quality || {}),
          dayMode: policy.dayMode,
          meal_policy_at_generation: {
            dayMode: policy.dayMode,
            requiredMeals: policy.requiredMeals,
            isFullExplorationDay: policy.isFullExplorationDay,
            recomputed_from_flight_change_at: new Date().toISOString(),
          },
        },
      },
    };
  });

  return {
    updatedDays,
    changed: changedDayNumbers.length > 0,
    changedDayNumbers,
  };
}
