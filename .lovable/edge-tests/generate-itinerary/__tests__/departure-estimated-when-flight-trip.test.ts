/**
 * Issue #5 — "Day 4 missing airport transit."
 *
 * Root cause: on a departure day, enforceDepartureDayLogistics only injects the
 * airport transfer + departure when a return-flight CLOCK reaches it
 * (returnDepartureTime24 or an on-day flight card). For round-trip flights whose
 * return leg didn't resolve, it injected a prunable "add your return flight"
 * prompt and the user was left with "checkout then nothing."
 *
 * Fix: the outbound ARRIVAL clock (arrivalTime24) is a signal the trip USES
 * FLIGHTS. When the return clock is unresolved but arrival is set, we GUARANTEE
 * an estimated transfer + departure scaffold (clearly flagged isEstimated) and
 * leave the traveler's real activities untouched. Non-flight trips (no arrival)
 * still get no fabricated airport cards.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceDepartureDayLogistics } from '../pipeline/repair-day.ts';

const hotel = {
  dayNumber: 4,
  hotelName: 'Lotte Hotel Seoul',
  hotelAddress: '30 Eulji-ro, Jung-gu',
  airportTransferMinutes: 60,
  isLastDay: true,
};

const isTransfer = (a: any) => String(a?.subcategory || '') === 'airport_transfer';
const isDeparture = (a: any) => String(a?.subcategory || '') === 'departure';
const isPrompt = (a: any) => String(a?.subcategory || '') === 'return_flight_missing';

Deno.test('flight trip, unresolved return clock → estimated transfer + departure are guaranteed', () => {
  const activities = [
    { id: 'breakfast', title: 'Breakfast at hotel', startTime: '08:00', endTime: '09:00', category: 'dining' },
    { id: 'checkout', title: 'Checkout', startTime: '10:00', endTime: '10:30', category: 'accommodation' },
  ];

  const out = enforceDepartureDayLogistics({
    ...hotel,
    activities,
    arrivalTime24: '14:30', // trip flew in → uses flights
    // returnDepartureTime24 deliberately absent, no flight card present
    lockedIds: new Set<string>(),
  });

  const transfer = out.activities.find(isTransfer);
  const departure = out.activities.find(isDeparture);

  assert(transfer, 'an airport transfer MUST be injected when the trip uses flights');
  assert(departure, 'a departure card MUST be injected when the trip uses flights');
  // Honesty: both are flagged estimated so the user confirms against the real flight.
  assertEquals((transfer as any).isEstimated, true, 'transfer must be flagged estimated');
  assertEquals((departure as any).isEstimated, true, 'departure must be flagged estimated');
  // No prunable "add your return flight" prompt when we injected a real scaffold.
  assertEquals(out.activities.some(isPrompt), false, 'no return-flight-missing prompt when scaffold injected');
  // The traveler's real morning activities are NOT dropped on a guess.
  assert(out.activities.some(a => a.id === 'breakfast'), 'breakfast must survive');
});

Deno.test('flight trip, unresolved return clock → does NOT drop the user\'s real activities', () => {
  const activities = [
    { id: 'checkout', title: 'Checkout', startTime: '11:00', endTime: '11:30', category: 'accommodation' },
    { id: 'museum', title: 'National Museum of Korea', startTime: '13:00', endTime: '15:00', category: 'culture' },
    { id: 'lunch', title: 'Lunch at Gwangjang Market', startTime: '12:00', endTime: '13:00', category: 'dining' },
  ];

  const out = enforceDepartureDayLogistics({
    ...hotel,
    activities,
    arrivalTime24: '16:00',
    lockedIds: new Set<string>(),
  });

  // Estimated departure is a guess — the user's timed afternoon plans stay.
  assert(out.activities.some(a => a.id === 'museum'), 'museum must survive estimated departure');
  assert(out.activities.some(a => a.id === 'lunch'), 'lunch must survive estimated departure');
});

Deno.test('non-flight trip (no arrival clock) → no airport cards fabricated', () => {
  const activities = [
    { id: 'checkout', title: 'Checkout', startTime: '10:00', endTime: '10:30', category: 'accommodation' },
  ];

  const out = enforceDepartureDayLogistics({
    ...hotel,
    activities,
    // no arrivalTime24, no returnDepartureTime24 → genuine non-flight / unknown
    lockedIds: new Set<string>(),
  });

  assertEquals(out.activities.some(isTransfer), false, 'must NOT fabricate a transfer on a non-flight trip');
  assertEquals(out.activities.some(isDeparture), false, 'must NOT fabricate a departure on a non-flight trip');
});

Deno.test('known return clock still injects a non-estimated transfer (regression)', () => {
  const activities = [
    { id: 'breakfast', title: 'Breakfast at hotel', startTime: '08:00', endTime: '09:00', category: 'dining' },
    { id: 'checkout', title: 'Checkout', startTime: '09:30', endTime: '10:00', category: 'accommodation' },
  ];

  const out = enforceDepartureDayLogistics({
    ...hotel,
    activities,
    returnDepartureTime24: '11:00',
    arrivalTime24: '14:30',
    lockedIds: new Set<string>(),
  });

  const transfer = out.activities.find(isTransfer);
  assert(transfer, 'transfer injected from known clock');
  assertEquals((transfer as any).isEstimated, undefined, 'known-clock transfer is NOT flagged estimated');
});
