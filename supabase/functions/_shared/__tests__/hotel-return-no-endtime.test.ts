/**
 * False-positive "Day N: no hotel return at end of day - regenerate this day"
 * toast on a day that DOES end with a hotel return.
 *
 * Root cause: MISSING_HOTEL_RETURN ranked the day's activities by endTime only.
 * A hotel-return card is a point-in-time with a start and often NO end, so it
 * was filtered out of the ranking — letting an earlier nightcap (which has an
 * end time) rank "last" and trip the warning.
 *
 * Fix: rank by endTime, falling back to startTime, so the return card is seen.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateItineraryForPersist } from '../validate-itinerary-for-persist.ts';

const ret = (id: string, title: string, start: string) => ({
  id, title, startTime: start, category: 'accommodation', // point-in-time: no endTime
  location: { name: title.replace(/^Return to\s+/i, '') },
});

Deno.test('hotel-return with a start time but NO end time is not flagged as missing', () => {
  const days = [
    { dayNumber: 1, title: 'Day 1', activities: [{ id: 'a1', title: 'Arrival', startTime: '14:00', endTime: '15:00', category: 'activity' }] },
    {
      dayNumber: 2, title: 'Day 2',
      activities: [
        { id: 'd', title: 'Dinner at T&K Seafood', startTime: '19:30', endTime: '21:00', category: 'dining', location: { name: 'T&K Seafood' }, description: 'Bustling Chinatown seafood institution — get the grilled prawns.' },
        { id: 'n', title: 'Nightcap at Teens of Thailand', startTime: '22:00', endTime: '23:00', category: 'activity' },
        // The day DOES end with a hotel return — but it has no endTime.
        ret('h', 'Return to Mandarin Oriental', '23:05'),
      ],
    },
    { dayNumber: 3, title: 'Day 3', activities: [{ id: 'co', title: 'Checkout', startTime: '07:00', endTime: '07:30', category: 'accommodation' }] },
  ];

  const v = validateItineraryForPersist(days, { destination: 'Bangkok, Thailand' });
  assertEquals(
    v.warnings.some((w) => w.code === 'MISSING_HOTEL_RETURN' && w.dayNumber === 2),
    false,
    'must NOT flag a missing hotel return when an (endTime-less) return card ends the day',
  );
});

Deno.test('a day that truly ends with a non-return activity still flags', () => {
  const days = [
    { dayNumber: 1, title: 'Day 1', activities: [{ id: 'a1', title: 'Arrival', startTime: '14:00', endTime: '15:00', category: 'activity' }] },
    {
      dayNumber: 2, title: 'Day 2',
      activities: [
        { id: 'd', title: 'Dinner at X', startTime: '19:30', endTime: '21:00', category: 'dining', location: { name: 'X' }, description: 'Great local spot with regional specialties to share.' },
        { id: 'club', title: 'Rooftop party', startTime: '22:00', endTime: '23:30', category: 'activity' }, // no return after
      ],
    },
    { dayNumber: 3, title: 'Day 3', activities: [{ id: 'co', title: 'Checkout', startTime: '07:00', endTime: '07:30', category: 'accommodation' }] },
  ];

  const v = validateItineraryForPersist(days, { destination: 'Bangkok, Thailand' });
  assert(
    v.warnings.some((w) => w.code === 'MISSING_HOTEL_RETURN' && w.dayNumber === 2),
    'must still flag when the day genuinely ends with a non-return activity past 19:00',
  );
});
