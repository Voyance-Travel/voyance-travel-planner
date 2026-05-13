/**
 * inferDayMode — derive a fallback dayMode from arrival/departure flight
 * times when the persisted `metadata.quality.dayMode` and
 * `metadata.quality.requiredMeals` are absent.
 *
 * Used ONLY by the read-side health engine (TripHealthPanel.analyzeHealth)
 * to decide whether breakfast / lunch / dinner are required on a given day.
 * Does NOT mutate persisted data; the canonical write-time logic lives in
 * the backend repair pipeline.
 *
 * Bands (mirror Core memory):
 *   Day 1 (arrival):
 *     < 09:30  → breakfast required (full day)
 *     09:30–11:59 → brunch day, no breakfast required (lunch + dinner)
 *     ≥ 12:00  → lunch-first (lunch + dinner)
 *   Last day (departure):
 *     ≥ 18:00  → all three meals
 *     15:00–17:59 → breakfast only (afternoon_departure, dinner skipped)
 *     12:00–14:59 → breakfast + lunch
 *     < 12:00  → breakfast only (early_departure)
 */

type Meal = 'breakfast' | 'lunch' | 'dinner';

function parseClockToMinutes(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  // Accept "HH:MM", "H:MM AM/PM", or ISO datetime "...THH:MM..."
  const iso = t.match(/T(\d{1,2}):(\d{2})/);
  if (iso) return parseInt(iso[1], 10) * 60 + parseInt(iso[2], 10);
  const ampm = t.toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const p = ampm[3];
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  return null;
}

import { inferArrivalMinsFromSchedule } from './inferArrivalFromSchedule';

function firstNonBookendStart(day: any): number | null {
  return inferArrivalMinsFromSchedule(day?.activities);
}

export interface InferDayModeInput {
  day: any;
  dayIndex: number;     // 0-based
  totalDays: number;
  tripFlightSelection?: any;
}

export interface InferredDayMode {
  dayMode: string;
  requiredMeals: Meal[];
}

export function inferDayModeFallback({
  day,
  dayIndex,
  totalDays,
  tripFlightSelection,
}: InferDayModeInput): InferredDayMode | null {
  const isFirst = dayIndex === 0;
  const isLast = dayIndex === totalDays - 1 && totalDays > 1;
  if (!isFirst && !isLast) return null;

  // Pull arrival/departure clock from flight_selection (multiple shapes
  // tolerated) or fall back to the first non-bookend activity start.
  const fs = tripFlightSelection || {};
  const outbound = fs.outbound || fs.outboundLeg || fs.legs?.[0] || fs;
  const ret = fs.return || fs.returnLeg || fs.legs?.[fs.legs?.length - 1] || fs;

  if (isFirst) {
    const arrivalRaw =
      outbound.arrival_time ?? outbound.arrivalTime ?? outbound.arrival ??
      fs.arrival_time ?? fs.arrivalTime;
    const arrivalMin = parseClockToMinutes(arrivalRaw) ?? firstNonBookendStart(day);
    if (arrivalMin === null) return null;

    if (arrivalMin < 9 * 60 + 30) {
      return { dayMode: 'morning_arrival_early', requiredMeals: ['breakfast', 'lunch', 'dinner'] };
    }
    if (arrivalMin < 12 * 60) {
      // Brunch band — explicitly NO breakfast required
      return { dayMode: 'morning_arrival', requiredMeals: ['lunch', 'dinner'] };
    }
    // ≥ 12:00 — lunch first, no breakfast
    return { dayMode: 'midday_arrival', requiredMeals: ['lunch', 'dinner'] };
  }

  // Last day — departure
  const departureRaw =
    ret.departure_time ?? ret.departureTime ?? ret.departure ??
    fs.departure_time ?? fs.departureTime;
  const departureMin = parseClockToMinutes(departureRaw);
  if (departureMin === null) return null;

  if (departureMin >= 18 * 60) {
    return { dayMode: 'evening_departure', requiredMeals: ['breakfast', 'lunch', 'dinner'] };
  }
  if (departureMin >= 15 * 60) {
    return { dayMode: 'afternoon_departure', requiredMeals: ['breakfast'] };
  }
  if (departureMin >= 12 * 60) {
    return { dayMode: 'midday_departure', requiredMeals: ['breakfast', 'lunch'] };
  }
  return { dayMode: 'early_departure', requiredMeals: ['breakfast'] };
}
