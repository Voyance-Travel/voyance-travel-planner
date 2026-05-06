import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { compileDaySchema } from './compile-day-schema.ts';
import type { DaySchemaInput } from './types.ts';

function makeInput(overrides: Partial<DaySchemaInput['flightContext']>): DaySchemaInput {
  return {
    isFirstDay: true,
    isLastDay: false,
    dayNumber: 1,
    totalDays: 5,
    destination: 'Paris',
    flightContext: {
      arrivalTime24: '07:30',
      arrivalTime: '07:30',
      hotelName: 'Four Seasons Hotel George V',
      hotelAddress: '31 Av. George V, 75008 Paris',
      ...overrides,
    },
    resolvedIsLastDayInCity: false,
    resolvedIsMultiCity: false,
    resolvedNextLegTransport: '',
    resolvedNextLegCity: '',
    resolvedNextLegTransportDetails: null,
    resolvedHotelOverride: null,
    resolvedIsTransitionDay: false,
    paramIsFirstDayInCity: true,
    paramIsTransitionDay: false,
    mustDoEventItems: [],
    arrivalAirportDisplay: 'CDG Airport',
    airportTransferMinutes: 60,
  };
}

Deno.test('Day 1 morning arrival: defers check-in to 15:00 with luggage drop', () => {
  const { dayConstraints } = compileDaySchema(makeInput({}));
  assertStringIncludes(dayConstraints, 'Luggage Drop at Four Seasons Hotel George V');
  assertStringIncludes(dayConstraints, '"15:00"');
  // Should NOT schedule a check-in at the early arrival-derived time
  assert(!dayConstraints.match(/Check-in at Four Seasons[^"]*"\s*\n\s*-\s*startTime: "0[0-9]:/));
});

Deno.test('Day 1 morning arrival with custom hotel check-in time honors property time', () => {
  const { dayConstraints } = compileDaySchema(
    makeInput({ hotelCheckInTime: '16:00' })
  );
  assertStringIncludes(dayConstraints, 'Luggage Drop');
  assertStringIncludes(dayConstraints, '"16:00"');
});

Deno.test('Day 1 afternoon arrival after check-in time: single check-in, no luggage drop', () => {
  const { dayConstraints } = compileDaySchema(
    makeInput({ arrivalTime24: '16:30', arrivalTime: '16:30' })
  );
  assert(!dayConstraints.includes('Luggage Drop'), 'no luggage drop expected');
  assertStringIncludes(dayConstraints, 'Check-in at Four Seasons Hotel George V');
});

Deno.test('Day 1 morning arrival with no hotel: uses Your Hotel placeholder + 15:00 check-in', () => {
  const input = makeInput({ hotelName: undefined, hotelAddress: undefined });
  const { dayConstraints } = compileDaySchema(input);
  assertStringIncludes(dayConstraints, 'Luggage Drop at Your Hotel');
  assertStringIncludes(dayConstraints, '"15:00"');
});
