/**
 * Regression tests for the inter-city journey card in repairDay — proving the
 * "don't force a flight" fix: a leg with NO chosen transport mode renders a
 * neutral "Travel to <city>" card (no flight, no airport), while an explicit
 * mode is honoured.
 */
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { repairDay } from './repair-day.ts';

function makeInput(nextLegTransport: string) {
  return {
    day: {
      dayNumber: 2,
      activities: [
        { id: 'a1', title: 'Breakfast at hotel', category: 'dining', startTime: '08:30', endTime: '09:30' },
        { id: 'a2', title: 'Checkout', category: 'accommodation', startTime: '11:00', endTime: '11:15' },
      ],
    },
    validationResults: [],
    dayNumber: 2,
    isFirstDay: false,
    isLastDay: false,
    isLastDayInCity: true,
    isMultiCity: true,
    hasHotel: true,
    hotelName: 'Hotel Madrid',
    resolvedDestination: 'Madrid',
    nextLegCity: 'Barcelona',
    nextLegTransport,
    lockedActivities: [],
  } as any;
}

function journeyCard(result: any) {
  return (result.day.activities || []).find((a: any) =>
    /to barcelona/i.test(a.title || '') &&
    ['flight', 'intercity_transport', 'transport'].includes((a.category || '').toLowerCase()),
  );
}

Deno.test('unset leg ("") → neutral "Travel to <city>" card, NOT a flight', () => {
  const result = repairDay(makeInput(''));
  const card = journeyCard(result);
  assert(card, 'expected an inter-city journey card to be injected');
  assertEquals(card.title, 'Travel to Barcelona');
  assertEquals((card.category || '').toLowerCase(), 'intercity_transport');
  // no airport / flight references leaked in
  assert(!/airport|flight/i.test(card.title), 'unset leg must not mention flight/airport');
  assert(!/airport/i.test(card.description || ''), 'unset leg description must not mention airport');
});

Deno.test('explicit flight leg → flight card', () => {
  const result = repairDay(makeInput('flight'));
  const card = journeyCard(result);
  assert(card, 'expected a journey card');
  assertEquals(card.title, 'Flight to Barcelona');
  assertEquals((card.category || '').toLowerCase(), 'flight');
});

Deno.test('explicit train leg → train card, no airport', () => {
  const result = repairDay(makeInput('train'));
  const card = journeyCard(result);
  assert(card, 'expected a journey card');
  assertEquals(card.title, 'Train to Barcelona');
  assertEquals((card.category || '').toLowerCase(), 'intercity_transport');
  assert(!/airport|flight/i.test(card.title), 'train leg must not mention flight/airport');
});

// A 0-night day trip (no hotel) must NOT get a placeholder "Checkout from Your
// Hotel" — that checkout then triggers the §14b post-checkout prune that strips
// the day's sightseeing, leaving a thin meals-only day.
Deno.test('0-night day trip (no hotel) → no checkout card injected', () => {
  const input = {
    day: { dayNumber: 1, activities: [
      { id: 's1', title: 'Centennial Olympic Park', category: 'sightseeing', startTime: '10:00', endTime: '12:00' },
      { id: 'l1', title: 'Lunch at Local Spot', category: 'dining', startTime: '13:00', endTime: '14:00' },
      { id: 's2', title: 'World of Coca-Cola', category: 'sightseeing', startTime: '15:00', endTime: '17:00' },
    ] },
    validationResults: [], dayNumber: 1, isFirstDay: true, isLastDay: true,
    hasHotel: false, lockedActivities: [], resolvedDestination: 'Atlanta',
  } as any;
  const result = repairDay(input);
  const titles = (result.day.activities || []).map((a: any) => String(a.title || ''));
  // no phantom hotel cards on a no-hotel day trip
  assert(!titles.some((t) => /check[\s-]?out|check[\s-]?in|return to .*hotel/i.test(t)), `no hotel cards expected, got: ${titles.join(', ')}`);
  // the real sightseeing must survive (not pruned by departure handling)
  assert(titles.includes('Centennial Olympic Park'), 'Centennial Olympic Park must survive');
  assert(titles.includes('World of Coca-Cola'), 'World of Coca-Cola must survive');
});
