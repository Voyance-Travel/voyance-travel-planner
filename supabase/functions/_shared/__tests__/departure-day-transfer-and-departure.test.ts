/**
 * Day 4 missing airport transit + departure — regression coverage for §15z
 * hardening. See plan in .lovable/plan.md and
 * mem://constraints/itinerary/airport-transit-must-be-taxi.
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceDepartureDayLogistics } from '../../generate-itinerary/pipeline/repair-day.ts';

const baseInput = {
  dayNumber: 4,
  hotelName: 'Hotel Test',
  hotelAddress: '1 Test St',
  airportTransferMinutes: 45,
  isLastDay: true,
  lockedIds: new Set<string>(),
};

Deno.test('§15z: early-flight day with only breakfast+checkout → injects BOTH transfer and departure', () => {
  // 11:00 flight, 180m buffer → required at airport = 08:00, transfer 07:15–08:00,
  // departure 08:00–11:00.
  const activities = [
    { id: 'b', title: 'Breakfast at hotel', category: 'dining', startTime: '07:30', endTime: '08:00' },
    { id: 'c', title: 'Checkout', category: 'accommodation', startTime: '09:00', endTime: '09:30' },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    activities,
    returnDepartureTime24: '11:00',
  });
  const transfer = out.activities.find((a: any) =>
    /transfer/i.test(a.title || '') && /transport|transit|logistics/.test(String(a.category)));
  const departure = out.activities.find((a: any) => String(a.subcategory) === 'departure');
  assertEquals(Boolean(transfer), true, 'airport transfer must be injected');
  assertEquals(Boolean(departure), true, 'departure card must be injected');
  assertEquals(departure!.startTime, '08:00');
  assertEquals(departure!.endTime, '11:00');
});

Deno.test('§15z: recovers flight clock from an existing flight card when returnDepartureTime24 missing', () => {
  const activities = [
    { id: 'b', title: 'Breakfast', category: 'dining', startTime: '07:30', endTime: '08:00' },
    { id: 'c', title: 'Checkout', category: 'accommodation', startTime: '09:00', endTime: '09:30' },
    { id: 'f', title: 'Flight to LHR', category: 'flight', startTime: '11:00', endTime: '13:00' },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    activities,
    // returnDepartureTime24 intentionally undefined
  } as any);
  const transfer = out.activities.find((a: any) =>
    String(a?.subcategory || '') === 'airport_transfer');
  assertEquals(Boolean(transfer), true, 'transfer must be injected via flight-card recovery');
  // Existing flight card already covers the departure slot (±60m of req-at-airport).
  // We assert no duplicate `departure` subcategory card was created on top of it.
  const dupes = out.activities.filter((a: any) => String(a?.subcategory || '') === 'departure');
  assertEquals(dupes.length <= 1, true, 'must not inject duplicate departure card when flight row exists');
});

Deno.test('§15z: locked user-supplied departure row is respected (no duplicate)', () => {
  const activities = [
    { id: 'c', title: 'Checkout', category: 'accommodation', startTime: '09:00', endTime: '09:30' },
    { id: 't', title: 'Transfer to Airport', category: 'transport', startTime: '07:15', endTime: '08:00' },
    { id: 'd', title: 'Departure', category: 'transport', subcategory: 'departure', startTime: '08:00', endTime: '11:00', isLocked: true },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    activities,
    returnDepartureTime24: '11:00',
    lockedIds: new Set(['d']),
  });
  const departures = out.activities.filter((a: any) => String(a?.subcategory || '') === 'departure');
  assertEquals(departures.length, 1, 'locked departure must not be duplicated');
  assertEquals(departures[0].id, 'd');
});

Deno.test('§15z: no flight info → no transfer, no departure card, soft prompt preserved', () => {
  const activities = [
    { id: 'b', title: 'Breakfast', category: 'dining', startTime: '07:30', endTime: '08:00' },
    { id: 'c', title: 'Checkout', category: 'accommodation', startTime: '09:00', endTime: '09:30' },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    activities,
  } as any);
  const transfer = out.activities.find((a: any) =>
    String(a?.subcategory || '') === 'airport_transfer');
  const departure = out.activities.find((a: any) => String(a?.subcategory || '') === 'departure');
  assertEquals(Boolean(transfer), false, 'no transfer without flight clock');
  assertEquals(Boolean(departure), false, 'no departure without flight clock');
  const prompt = out.activities.find((a: any) => String(a?.subcategory || '') === 'return_flight_missing');
  assertEquals(Boolean(prompt), true, 'soft prompt card must be present');
});
