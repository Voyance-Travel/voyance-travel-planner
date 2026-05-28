import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildEmptyDaySkeleton } from './build-day-skeleton.ts';

Deno.test('skeleton: standard balanced middle day has 3 required meals', () => {
  const { skeleton, omitted } = buildEmptyDaySkeleton({
    dayNumber: 3,
    totalDays: 5,
    date: '2026-06-10',
    destination: 'Rome',
    isFirstDay: false,
    isLastDay: false,
    patternGroup: 'balanced',
    hasHotelData: true,
  });
  assertEquals(skeleton.dayType, 'standard');
  assertEquals(omitted.length, 0);
  const meals = skeleton.slots.filter((s) => s.slotType === 'meal');
  assertEquals(meals.length, 3);
  assertEquals(meals.map((m) => m.mealType).sort(), ['breakfast', 'dinner', 'lunch']);
  for (const m of meals) assert(m.required);
});

Deno.test('skeleton: late-night arrival drops breakfast/lunch, keeps dinner', () => {
  const { skeleton } = buildEmptyDaySkeleton({
    dayNumber: 1,
    totalDays: 3,
    date: '2026-06-01',
    destination: 'Rome',
    isFirstDay: true,
    isLastDay: false,
    patternGroup: 'balanced',
    arrivalTime24: '22:10',
    hasHotelData: true,
  });
  assertEquals(skeleton.dayType, 'latenight_arrival');
  const meals = skeleton.slots.filter((s) => s.slotType === 'meal');
  assertEquals(meals.length, 1);
  assertEquals(meals[0].mealType, 'dinner');
});

Deno.test('skeleton: must-dos pre-allocate slots with mustDoRef', () => {
  const { skeleton } = buildEmptyDaySkeleton({
    dayNumber: 2,
    totalDays: 4,
    date: '2026-06-02',
    destination: 'Rome',
    isFirstDay: false,
    isLastDay: false,
    patternGroup: 'balanced',
    mustDos: [
      { id: 'trevi', title: 'Trevi Fountain', category: 'sightseeing', priority: 10 },
      { id: 'colos', title: 'Colosseum', category: 'culture', priority: 9 },
    ],
  });
  const refs = skeleton.slots.filter((s) => s.mustDoRef).map((s) => s.mustDoRef);
  assertEquals(refs.sort(), ['colos', 'trevi']);
});

Deno.test('skeleton: departure day pins checkout + transfer + departure', () => {
  const { skeleton } = buildEmptyDaySkeleton({
    dayNumber: 5,
    totalDays: 5,
    date: '2026-06-15',
    destination: 'Rome',
    isFirstDay: false,
    isLastDay: true,
    patternGroup: 'balanced',
    departureTime24: '17:00',
    hasHotelData: true,
    hotelCheckOutTime: '11:00',
    airportTransferMinutes: 60,
  });
  assertEquals(skeleton.dayType, 'departure');
  const types = skeleton.slots.map((s) => s.slotType);
  assert(types.includes('hotel_checkout'));
  assert(types.includes('departure'));
});

Deno.test('skeleton: nightlife slot cannot start before evening (no 9am nightcap)', () => {
  // Building an arbitrary day; nightlife slots should never get a morning window.
  const { skeleton } = buildEmptyDaySkeleton({
    dayNumber: 2,
    totalDays: 3,
    date: '2026-06-02',
    destination: 'Rome',
    isFirstDay: false,
    isLastDay: false,
    patternGroup: 'social', // social has evening slots
    hasHotelData: true,
  });
  const evenings = skeleton.slots.filter((s) => s.slotType === 'evening');
  assert(evenings.length > 0);
  for (const e of evenings) {
    assert(e.timeWindow, 'evening slot must have a time window');
    const earliest = e.timeWindow!.earliest;
    const hour = Number(earliest.split(':')[0]);
    assert(hour >= 18, `evening earliest ${earliest} must be >= 18:00`);
  }
});
