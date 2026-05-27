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
import { getFirstLegArrivalTime, getLastLegDepartureTime, getDestinationArrivalLeg } from '@/utils/normalizeFlightSelection';
import { normalizeTimeTo24h } from '@/utils/timeFormat';

interface Leg {
  airline?: string;
  flightNumber?: string;
  departure?: { time?: string; airport?: string; date?: string };
  arrival?: { time?: string; airport?: string; date?: string };
  isDestinationArrival?: boolean;
  isDestinationDeparture?: boolean;
}

interface FlightSelection {
  legs?: Leg[];
  departure?: { arrival?: { time?: string; date?: string } };
  return?: { departure?: { time?: string; date?: string } };
}

export function extractArrivalDeparture24(
  flightSelection: FlightSelection | null | undefined
): { arrivalTime24?: string; departureTime24?: string } {
  if (!flightSelection) return {};

  const arrivalTime24 = normalizeTimeTo24h(getFirstLegArrivalTime(flightSelection));
  const departureTime24 = normalizeTimeTo24h(getLastLegDepartureTime(flightSelection));

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
  
  // Cross-day flight detection:
  // If the destination-arrival leg's arrival date is later than its departure date,
  // then the arrival day for meal purposes might be Day 2.
  const arrivalLeg = getDestinationArrivalLeg(flightSelection);
  const depDate = arrivalLeg?.departure?.date?.substring(0, 10);
  const arrDate = arrivalLeg?.arrival?.date?.substring(0, 10);
  const isCrossDayArrival = depDate && arrDate && arrDate > depDate;

  const totalDays = days.length;
  const changedDayNumbers: number[] = [];

  const updatedDays = days.map((day, i) => {
    const dayNumber = day?.dayNumber || i + 1;
    
    // Arrival Day Logic:
    // Usually Day 1. But if cross-day flight, Day 2 is the arrival day.
    const isArrivalDay = isCrossDayArrival ? dayNumber === 2 : dayNumber === 1;
    const isLastDay = dayNumber === totalDays;

    // Only arrival day and last day are affected by flight times; mid-trip days
    // remain untouched (transition/full-day-event flags are out of scope here).
    if (!isArrivalDay && !isLastDay) {
      // If this was previously marked as an arrival day but shouldn't be anymore,
      // we might need to revert it to full_exploration.
      const prevMode = day?.metadata?.quality?.dayMode;
      if (prevMode && prevMode !== 'full_exploration' && !day?.metadata?.quality?.dayMode_locked) {
        // Fall through to recompute
      } else {
        return day;
      }
    }

    if (day?.metadata?.quality?.dayMode_locked === true) return day;

    const policy = deriveMealPolicy({
      dayNumber,
      totalDays,
      isFirstDay: isArrivalDay,
      isLastDay,
      arrivalTime24: isArrivalDay ? arrivalTime24 : undefined,
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
