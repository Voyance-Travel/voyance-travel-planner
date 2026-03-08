/**
 * Just Tell Us Date Guard
 * 
 * Ensures chat-extracted trip dates are never in the past and never use
 * a year before MIN_TRIP_YEAR (2026). This is a hard safety net that runs
 * client-side after the AI returns dates and before they hit the database.
 */

import { parseLocalDate, getLocalToday } from '@/utils/dateUtils';

/** Absolute minimum year we allow for trip planning */
const MIN_TRIP_YEAR = 2026;

/** Format a Date as YYYY-MM-DD using local components (no UTC drift) */
function formatIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Normalize chat-extracted trip dates so they are never in the past
 * and never use a year before MIN_TRIP_YEAR.
 *
 * Rules:
 * 1. If the year is < MIN_TRIP_YEAR, bump it to MIN_TRIP_YEAR (preserve month/day).
 * 2. If the resulting startDate is still in the past, roll both dates forward by 1 year.
 * 3. Trip duration (days between start and end) is always preserved.
 * 4. endDate is always >= startDate.
 */
export function normalizeChatTripDates(
  startDateStr: string,
  endDateStr: string,
): { startDate: string; endDate: string } {
  if (!startDateStr || !endDateStr) return { startDate: startDateStr, endDate: endDateStr };

  let start = parseLocalDate(startDateStr);
  let end = parseLocalDate(endDateStr);

  // Preserve trip duration in days
  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.max(0, Math.round(durationMs / 86_400_000));

  // Step 1: Bump year to MIN_TRIP_YEAR if below
  if (start.getFullYear() < MIN_TRIP_YEAR) {
    const yearDiff = MIN_TRIP_YEAR - start.getFullYear();
    start = new Date(start.getFullYear() + yearDiff, start.getMonth(), start.getDate());
  }

  // Recompute end from start + duration to preserve trip length
  end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + durationDays);

  // Step 2: If start is still in the past, roll forward by 1 year
  const todayStr = getLocalToday();
  const today = parseLocalDate(todayStr);
  if (start.getTime() < today.getTime()) {
    start = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + durationDays);
  }

  // Step 3: Safety — end must be >= start
  if (end.getTime() < start.getTime()) {
    end = new Date(start.getTime());
  }

  return {
    startDate: formatIsoLocal(start),
    endDate: formatIsoLocal(end),
  };
}
