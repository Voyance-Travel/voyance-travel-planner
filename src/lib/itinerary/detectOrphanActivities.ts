/**
 * Detect itinerary days whose date falls outside the trip's [start_date, end_date]
 * window. These are "orphans" — activities that won't show up in the live
 * itinerary view but still consume budget/payments slots and confuse users.
 *
 * Common causes:
 *  - Trip dates edited via SQL or before TripDetail.handleDateChange existed.
 *  - Race conditions during regen.
 *  - Future regressions where someone bypasses the TripDateEditor flow.
 *
 * Surfaced as a non-blocking banner in EditorialItinerary; user picks
 * shift / archive / dismiss.
 */

export interface OrphanDay {
  dayNumber: number;
  date: string;
  activityCount: number;
  position: 'before' | 'after';
}

export interface OrphanReport {
  outOfRangeDays: OrphanDay[];
  beforeStart: number;
  afterEnd: number;
  totalActivities: number;
}

interface DetectArgs {
  startDate?: string | null;
  endDate?: string | null;
  days: Array<{
    dayNumber?: number;
    date?: string | null;
    activities?: unknown[];
  }>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept full ISO strings too — first 10 chars only.
  const head = trimmed.slice(0, 10);
  return ISO_DATE_RE.test(head) ? head : null;
}

export function detectOrphanActivities(args: DetectArgs): OrphanReport {
  const start = normalizeDate(args.startDate);
  const end = normalizeDate(args.endDate);
  const empty: OrphanReport = {
    outOfRangeDays: [],
    beforeStart: 0,
    afterEnd: 0,
    totalActivities: 0,
  };
  if (!start || !end) return empty;

  const out: OrphanDay[] = [];
  let beforeStart = 0;
  let afterEnd = 0;
  let total = 0;

  for (const day of args.days || []) {
    const date = normalizeDate(day?.date);
    // Skip new blank/inserted days with no date — they're not orphans yet.
    if (!date) continue;
    const activityCount = Array.isArray(day?.activities) ? day.activities.length : 0;
    if (date < start) {
      out.push({
        dayNumber: Number(day?.dayNumber) || 0,
        date,
        activityCount,
        position: 'before',
      });
      beforeStart += activityCount;
      total += activityCount;
    } else if (date > end) {
      out.push({
        dayNumber: Number(day?.dayNumber) || 0,
        date,
        activityCount,
        position: 'after',
      });
      afterEnd += activityCount;
      total += activityCount;
    }
  }

  return {
    outOfRangeDays: out,
    beforeStart,
    afterEnd,
    totalActivities: total,
  };
}
