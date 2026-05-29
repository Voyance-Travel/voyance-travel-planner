/**
 * Amsterdam QA regression fixture — locks the four invariants the
 * commit gate must catch BEFORE a trip can ship as ready.
 *
 * Closes:
 *  - S-1 Flight-time mismatch (10pm arrival → 8pm card)
 *  - S-2 Post-check-in airport loop on arrival night
 *  - P-2 Priced hotel surfaced as Free in Payments
 *  - M-1 Must-do "Take a canal boat tour" silently dropped
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkItineraryIntegrity } from '../itinerary-integrity-contract.ts';

const amsterdamDays = [
  {
    dayNumber: 1,
    title: 'Arrival & Canal Belt',
    activities: [
      // BUG S-1: arrival truth is 22:00 but card stamps 20:00. Card is
      // system-locked (anchor-guard) — gate must check it anyway.
      {
        id: 'd1-arrival',
        title: 'Arrival Flight',
        category: 'flight',
        anchorSource: 'arrival-flight',
        source: 'repair-arrival-flight',
        isLocked: true,
        startTime: '20:00',
        endTime: '22:00',
      },
      {
        id: 'd1-transfer',
        title: 'Transfer to Hotel V Nesplein',
        category: 'transport',
        anchorSource: 'airport-transfer',
        source: 'repair-airport-transfer',
        isLocked: true,
        startTime: '22:30',
        endTime: '23:05',
      },
      {
        id: 'd1-checkin',
        title: 'Check-in at Hotel V Nesplein',
        category: 'accommodation',
        source: 'system-checkin',
        isLocked: true,
        startTime: '23:05',
        endTime: '23:35',
      },
      // BUG S-2: post-checkin airport transfer = loop.
      {
        id: 'd1-airport-loop',
        title: 'Airport Transfer',
        category: 'transport',
        anchorSource: 'airport-transfer',
        isLocked: true,
        startTime: '23:35',
        endTime: '23:55',
      },
    ],
  },
  {
    dayNumber: 2,
    title: 'Museums & Jordaan',
    activities: [
      { id: 'd2-breakfast', title: 'Breakfast at Bakers & Roasters', category: 'dining', startTime: '09:00', endTime: '10:00' },
      { id: 'd2-rijks', title: 'Rijksmuseum', category: 'sightseeing', startTime: '10:30', endTime: '13:00' },
      { id: 'd2-lunch', title: 'Lunch at Bros', category: 'dining', startTime: '13:15', endTime: '14:15' },
      { id: 'd2-anne', title: 'Anne Frank House', category: 'sightseeing', startTime: '15:00', endTime: '16:30' },
      { id: 'd2-dinner', title: 'Dinner at Moeders', category: 'dining', startTime: '19:00', endTime: '20:30' },
    ],
  },
];

Deno.test('amsterdam fixture — flight anchor mismatch BLOCKS ready', () => {
  const verdict = checkItineraryIntegrity(amsterdamDays, {
    hotelName: 'Hotel V Nesplein',
    arrivalTime24: '22:00',
    departureTime24: null,
    requiredIntents: [{ title: 'Take a canal boat tour', dayNumber: null }],
    hotelTotalPriceUsdCents: 60000, // $200 × 3
    budgetIncludeHotel: false,
  });
  assert(!verdict.ok, 'verdict must NOT be ok');
  assert(
    verdict.codes.includes('FLIGHT_ANCHOR_COMMIT_MISMATCH'),
    `expected FLIGHT_ANCHOR_COMMIT_MISMATCH; got [${verdict.codes.join(',')}]`,
  );
});

Deno.test('amsterdam fixture — post-checkin airport loop BLOCKS ready', () => {
  const verdict = checkItineraryIntegrity(amsterdamDays, {
    hotelName: 'Hotel V Nesplein',
    arrivalTime24: '22:00',
  });
  assert(
    verdict.codes.includes('AIRPORT_LOOP_ON_NON_DEPARTURE'),
    `expected AIRPORT_LOOP_ON_NON_DEPARTURE; got [${verdict.codes.join(',')}]`,
  );
});

Deno.test('amsterdam fixture — missing canal boat must-do BLOCKS ready', () => {
  const verdict = checkItineraryIntegrity(amsterdamDays, {
    hotelName: 'Hotel V Nesplein',
    arrivalTime24: '22:00',
    requiredIntents: [{ title: 'Take a canal boat tour', dayNumber: null }],
  });
  assert(
    verdict.codes.includes('REQUIRED_USER_INTENT_MISSING'),
    `expected REQUIRED_USER_INTENT_MISSING; got [${verdict.codes.join(',')}]`,
  );
});

Deno.test('amsterdam fixture — priced hotel not surfaced BLOCKS ready', () => {
  const verdict = checkItineraryIntegrity(amsterdamDays, {
    hotelName: 'Hotel V Nesplein',
    arrivalTime24: '22:00',
    hotelTotalPriceUsdCents: 60000,
    budgetIncludeHotel: false,
  });
  assert(
    verdict.codes.includes('HOTEL_COST_NOT_SURFACED'),
    `expected HOTEL_COST_NOT_SURFACED; got [${verdict.codes.join(',')}]`,
  );
});

Deno.test('amsterdam fixture — after fixing all four, verdict.ok = true', () => {
  const healed = JSON.parse(JSON.stringify(amsterdamDays));
  // Fix S-1
  healed[0].activities[0].startTime = '22:00';
  healed[0].activities[0].endTime = '22:15';
  // Fix S-2: drop the airport loop
  healed[0].activities = healed[0].activities.filter((a: any) => a.id !== 'd1-airport-loop');
  // Fix M-1: add canal boat tour
  healed[1].activities.push({
    id: 'd2-canal',
    title: 'Canal Boat Tour',
    category: 'sightseeing',
    startTime: '17:00',
    endTime: '18:30',
  });
  const verdict = checkItineraryIntegrity(healed, {
    hotelName: 'Hotel V Nesplein',
    arrivalTime24: '22:00',
    requiredIntents: [{ title: 'Take a canal boat tour', dayNumber: null }],
    hotelTotalPriceUsdCents: 60000,
    budgetIncludeHotel: true, // Fix P-2: include hotel in budget
  });
  assertEquals(verdict.codes, [], `unexpected codes: [${verdict.codes.join(',')}]`);
  assert(verdict.ok, 'healed fixture must pass');
});
