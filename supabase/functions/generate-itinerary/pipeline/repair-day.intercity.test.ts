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
