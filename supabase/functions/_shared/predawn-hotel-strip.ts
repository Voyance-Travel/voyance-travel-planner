/**
 * Shared pre-dawn hotel-return stripper.
 *
 * Removes any leading activity that:
 *  - starts between 00:00 and 04:59, AND
 *  - is a hotel/return/accommodation entry (or has accommodation/stay category)
 *
 * Stops stripping at the first non-pre-dawn activity (or first non-hotel pre-dawn one).
 * Mutates the array in place. Returns the number of removed entries.
 */
const HOTEL_TITLE_RE =
  /\b(?:return\s+to|check.?in|check.?out|hotel|freshen\s+up|rest\s+and\s+refresh|retire|settle|wind\s+down|end.?of.?day|back\s+to)\b/i;

function startMinsOf(act: any): number | null {
  const t = String(act?.startTime || act?.start_time || act?.time || '');
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(t) && h < 12) h += 12;
  if (/am/i.test(t) && h === 12) h = 0;
  return h * 60 + mm;
}

export function stripPreDawnHotelReturns(
  activities: any[],
  context?: { dayNumber?: number; label?: string },
): number {
  if (!Array.isArray(activities) || activities.length === 0) return 0;
  const label = context?.label || 'predawn-strip';
  const dayLabel = context?.dayNumber != null ? `day ${context.dayNumber}` : '';

  let removed = 0;
  // Walk from the start, removing pre-dawn hotel entries until we hit a real activity.
  while (activities.length > 0) {
    const act = activities[0];
    const mins = startMinsOf(act);
    // If no parseable time or not in 00:00–04:59 window, stop.
    if (mins === null || mins >= 5 * 60) break;

    const title = String(act?.title || act?.name || '').toLowerCase();
    const cat = String(act?.category || '').toLowerCase();
    const type = String(act?.type || '').toLowerCase();
    const isHotelEntry =
      HOTEL_TITLE_RE.test(title) ||
      cat === 'accommodation' ||
      cat === 'stay' ||
      type === 'stay';

    if (!isHotelEntry) break;

    console.warn(
      `[${label}] PRE-DAWN HOTEL STRIP ${dayLabel}: removing "${act?.title}" at ${
        act?.startTime || act?.start_time || act?.time
      }`,
    );
    activities.shift();
    removed++;
  }

  return removed;
}

export const __PREDAWN_HOTEL_TITLE_RE = HOTEL_TITLE_RE;
