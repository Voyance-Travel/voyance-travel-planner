/**
 * Display bug: an 11:00 AM long-haul return flight rendered as
 * "11:00 AM → 11:30 PM" because the model stamped the flight card's endTime as
 * a naive same-day "landing" (~23:30). For a 17h international flight that lands
 * two days later in another timezone, a same-day end time is meaningless.
 *
 * §15z now clamps any departure-day flight card whose span exceeds a sane
 * departure window down to start + 120m.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceDepartureDayLogistics } from '../pipeline/repair-day.ts';

const base = {
  dayNumber: 4,
  hotelName: 'Mandarin Oriental Bangkok',
  hotelAddress: '48 Oriental Ave',
  airportTransferMinutes: 60,
  isLastDay: true,
};

Deno.test('long-haul departure flight card end-time is clamped (no bogus same-day PM landing)', () => {
  const activities = [
    { id: 'checkout', title: 'Checkout', startTime: '06:50', endTime: '07:05', category: 'accommodation' },
    // The bug: AI stamped a same-day "landing" 12.5h later.
    { id: 'flight', title: 'BKK → Home', startTime: '11:00', endTime: '23:30', category: 'flight' },
  ];

  const out = enforceDepartureDayLogistics({
    ...base,
    activities,
    returnDepartureTime24: '11:00',
    lockedIds: new Set<string>(),
  });

  const flight = out.activities.find((a) => a.id === 'flight');
  assert(flight, 'flight card preserved');
  assertEquals(flight.startTime, '11:00', 'departure time unchanged');
  assertEquals(flight.endTime, '13:00', 'end clamped to start + 120m (no 11:30 PM)');
  assert(
    out.repairs.some((r) => (r as any).action === 'final_enforce_flight_endtime_clamped'),
    'clamp repair recorded',
  );
});

Deno.test('a normal short flight card is left untouched', () => {
  const activities = [
    { id: 'checkout', title: 'Checkout', startTime: '06:50', endTime: '07:05', category: 'accommodation' },
    { id: 'flight', title: 'Departure Flight', startTime: '11:00', endTime: '13:00', category: 'flight' },
  ];

  const out = enforceDepartureDayLogistics({
    ...base,
    activities,
    returnDepartureTime24: '11:00',
    lockedIds: new Set<string>(),
  });

  const flight = out.activities.find((a) => a.id === 'flight');
  assertEquals(flight.endTime, '13:00', 'already-sane flight window untouched');
  assertEquals(
    out.repairs.some((r) => (r as any).action === 'final_enforce_flight_endtime_clamped'),
    false,
    'no clamp when span is already reasonable',
  );
});
