/**
 * Time-of-day band classifier for the itinerary timeline section headers.
 *
 * The header in `EditorialItinerary` groups activities into bands. Without a
 * dedicated `Late Night` band, any wrap-window card (e.g. a 00:16
 * `late_nightlife_bookend`) falls into "Morning" and reads as the day's
 * morning anchor — that is what the user sees when the bug fires.
 *
 * Bands:
 *   00:00–04:59  → 'Late Night'
 *   05:00–11:59  → 'Morning'
 *   12:00–16:59  → 'Afternoon'
 *   17:00–23:59  → 'Evening'
 *   parse fail   → ''
 *
 * See mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
 */

export type TimeOfDayBand = '' | 'Late Night' | 'Morning' | 'Afternoon' | 'Evening';

function parseHour(time: unknown): number | null {
  if (typeof time !== 'string' || !time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  if (Number.isNaN(h)) return null;
  if (/pm/i.test(time) && h < 12) h += 12;
  if (/am/i.test(time) && h === 12) h = 0;
  return h;
}

export function timeOfDayBand(time: unknown): TimeOfDayBand {
  const h = parseHour(time);
  if (h === null) return '';
  if (h < 5) return 'Late Night';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
