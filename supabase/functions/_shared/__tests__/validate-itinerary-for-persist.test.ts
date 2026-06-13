// Tests for the persist-time validation gate.
// See supabase/functions/_shared/validate-itinerary-for-persist.ts.

import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateItineraryForPersist } from '../validate-itinerary-for-persist.ts';

function dining(id: string, title: string, start: string, end: string, desc = '', extra: any = {}) {
  return {
    id, title, startTime: start, endTime: end, category: 'dining',
    location: { name: title.replace(/^[^@]*\bat\s+/i, '') },
    description: desc, ...extra,
  };
}
function activity(id: string, title: string, start: string, end: string, extra: any = {}) {
  return { id, title, startTime: start, endTime: end, category: 'activity', ...extra };
}
function fullDay(dayNumber: number, activities: any[]) {
  return { dayNumber, date: `2026-05-${10 + dayNumber}`, title: `Day ${dayNumber}`, activities };
}

Deno.test('ok=true on a clean day', () => {
  const days = [fullDay(1, [
    dining('b', 'Breakfast at Café X', '08:30', '09:30', 'A great Parisian breakfast spot — try the croissants.'),
    activity('m', 'Louvre tour', '10:00', '13:00'),
    dining('l', 'Lunch at Bistrot Y', '13:30', '14:30', 'Classic French bistro fare in the Marais — book ahead.'),
    activity('a', 'Walk in Tuileries', '15:00', '17:00'),
    dining('d', 'Dinner at Le Z', '19:30', '21:30', 'Inventive tasting menu near the canal — try the duck.'),
  ])];
  const v = validateItineraryForPersist(days, { destination: 'Paris, France' });
  assert(v.ok, JSON.stringify(v.errors));
});

Deno.test('flags MISSING_REQUIRED_MEAL when breakfast absent on full day', () => {
  // Day 2 must be a MID-TRIP full day to require all three meals. The last day
  // of a trip with no return flight set is intentionally kept light (no
  // mandatory meals — see meal-policy.ts), so a 3rd day keeps Day 2 in the
  // middle where breakfast is genuinely required.
  const days = [
    fullDay(1, [activity('a', 'Arrival', '14:00', '15:00')]),
    fullDay(2, [
      // No breakfast — should flag
      activity('m', 'Museum', '10:00', '13:00'),
      dining('l', 'Lunch at L', '13:30', '14:30', 'Local trattoria with great pasta.'),
      dining('d', 'Dinner at D', '19:30', '21:00', 'Family-run osteria, get the tiramisu.'),
    ]),
    fullDay(3, [
      dining('b3', 'Breakfast at B3', '08:30', '09:30', 'Cozy bakery with fresh pastries.'),
      dining('l3', 'Lunch at L3', '13:00', '14:00', 'Dim sum institution, classic carts.'),
      dining('d3', 'Dinner at D3', '19:30', '21:00', 'Harbourfront seafood, book ahead.'),
    ]),
  ];
  const v = validateItineraryForPersist(days, { destination: 'Hong Kong' });
  assertEquals(v.ok, false);
  assert(v.errors.some(e => e.code === 'MISSING_REQUIRED_MEAL' && e.dayNumber === 2));
});

Deno.test('flags EMPTY_DINING_DESCRIPTION', () => {
  const days = [fullDay(2, [
    dining('b', 'Breakfast at Maison X', '08:30', '09:30', ''),
    activity('m', 'Tour', '10:00', '13:00'),
    dining('l', 'Lunch at Y', '13:30', '14:30', 'Solid neighborhood lunch spot — book ahead.'),
    dining('d', 'Dinner at Z', '19:30', '21:00', 'Inventive tasting near the harbor.'),
  ])];
  const v = validateItineraryForPersist(days, { destination: 'Hong Kong' });
  assert(v.errors.some(e => e.code === 'EMPTY_DINING_DESCRIPTION'));
});

Deno.test('flags PHANTOM_PREDAWN_CARD but skips late_nightlife_bookend', () => {
  const days = [fullDay(2, [
    activity('p', 'Random thing', '01:20', '02:20'),
    activity('lb', 'Return to Belmond', '00:30', '01:00', { source: 'late_nightlife_bookend' }),
    dining('b', 'Breakfast at X', '08:30', '09:30', 'Local cafe with strong coffee.'),
    dining('l', 'Lunch at Y', '13:00', '14:00', 'Solid lunch — book ahead.'),
    dining('d', 'Dinner at Z', '20:00', '22:00', 'Inventive tasting menu — book ahead.'),
  ])];
  const v = validateItineraryForPersist(days);
  const phantoms = v.errors.filter(e => e.code === 'PHANTOM_PREDAWN_CARD');
  assertEquals(phantoms.length, 1);
  assertEquals(phantoms[0].activityId, 'p');
});

Deno.test('flags OVERLONG_ACTIVITY (>6h)', () => {
  const days = [fullDay(2, [
    activity('iron', 'Iron Fairies', '12:00', '21:00'), // 9h
    dining('b', 'Breakfast at X', '08:30', '09:30', 'Local cafe with strong coffee.'),
    dining('l', 'Lunch at Y', '11:00', '12:00', 'Solid lunch — book ahead.'),
    dining('d', 'Dinner at Z', '21:30', '22:30', 'Late dinner — book ahead.'),
  ])];
  const v = validateItineraryForPersist(days, { destination: 'Bangkok, Thailand' });
  assert(v.errors.some(e => e.code === 'OVERLONG_ACTIVITY' && e.activityId === 'iron'));
});

Deno.test('warns CURRENCY_MISMATCH for HKD destination with CNY costs', () => {
  const days = [fullDay(2, [
    dining('b', 'Breakfast at X', '08:30', '09:30', 'HK breakfast spot.', { cost: { amount: 50, currency: 'CNY' } }),
    dining('l', 'Lunch at Y', '13:00', '14:00', 'Local dim sum.', { cost: { amount: 80, currency: 'CNY' } }),
    dining('d', 'Dinner at Z', '20:00', '22:00', 'Inventive Cantonese.', { cost: { amount: 200, currency: 'CNY' } }),
  ])];
  const v = validateItineraryForPersist(days, { destination: 'Hong Kong' });
  assert(v.warnings.some(w => w.code === 'CURRENCY_MISMATCH'));
  // Still ok=true since it's a warning.
});

Deno.test('warns MISSING_HOTEL_RETURN when day ends late without return card', () => {
  const days = [
    fullDay(1, [
      dining('b', 'Breakfast at X', '08:30', '09:30', 'Cafe.'),
      dining('l', 'Lunch at Y', '13:00', '14:00', 'Lunch spot.'),
      dining('d', 'Dinner at Z', '19:30', '21:30', 'Late dinner — book ahead.'),
    ]),
    fullDay(2, [activity('dep', 'Departure', '08:00', '12:00')]),
  ];
  const v = validateItineraryForPersist(days);
  assert(v.warnings.some(w => w.code === 'MISSING_HOTEL_RETURN' && w.dayNumber === 1));
});

Deno.test('flags EMPTY_DAY when only logistics present', () => {
  const days = [fullDay(1, [activity('t', 'Transit to airport', '08:00', '09:00', { category: 'transit' })])];
  const v = validateItineraryForPersist(days);
  assert(v.errors.some(e => e.code === 'EMPTY_DAY'));
});

Deno.test('exempts legit DEPARTURE day with checkout + transfer + flight (Rome pattern)', () => {
  const days = [
    fullDay(1, [
      dining('b', 'Breakfast at X', '08:30', '09:30', 'Pastry shop.'),
      dining('l', 'Lunch at Y', '13:00', '14:00', 'Trattoria.'),
      dining('d', 'Dinner at Z', '19:30', '21:00', 'Roman classics — book ahead.'),
    ]),
    fullDay(2, [
      activity('co', 'Checkout from Hotel de Russie', '10:00', '10:30', { category: 'accommodation' }),
      activity('xfer', 'Transfer to the Airport', '11:00', '12:00', { category: 'transfer' }),
      activity('fl', 'Departure Flight', '14:00', '17:00', { category: 'flight' }),
    ]),
  ];
  const v = validateItineraryForPersist(days, { destination: 'Rome, Italy', departureTime24: '14:00' });
  // No EMPTY_DAY error → trip is NOT collapsed to partial.
  assert(!v.errors.some(e => e.code === 'EMPTY_DAY'), 'should not flag EMPTY_DAY on legit departure');
  // Still surfaced as a non-blocking warning so UI can show a badge.
  assert(v.warnings.some(w => w.code === 'DEPARTURE_DAY_LIGHT'));
});

Deno.test('still flags EMPTY_DAY mid-trip even if logistics present', () => {
  const days = [
    fullDay(1, [
      dining('b', 'Breakfast at X', '08:30', '09:30', 'Pastry shop.'),
      dining('l', 'Lunch at Y', '13:00', '14:00', 'Trattoria.'),
      dining('d', 'Dinner at Z', '19:30', '21:00', 'Roman classics — book ahead.'),
    ]),
    fullDay(2, [
      activity('t', 'Transfer to airport', '11:00', '12:00', { category: 'transfer' }),
    ]),
    fullDay(3, [
      dining('b', 'Breakfast', '08:30', '09:30', 'Local.'),
      dining('l', 'Lunch', '13:00', '14:00', 'Local.'),
      dining('d', 'Dinner', '19:30', '21:00', 'Local — book ahead.'),
    ]),
  ];
  const v = validateItineraryForPersist(days);
  // Mid-trip Day 2 with only a transfer = real bug, must still flag EMPTY_DAY.
  assert(v.errors.some(e => e.code === 'EMPTY_DAY' && e.dayNumber === 2));
});
