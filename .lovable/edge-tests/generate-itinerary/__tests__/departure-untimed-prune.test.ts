/**
 * Regression: untimed non-dining-tagged card on departure day must be pruned.
 *
 * The Katsukura Sanjo Honten pattern — a real restaurant emitted by the
 * generator with category="cultural" (or empty) and no startTime/start_time/time
 * was previously slipping past §15z's dining-only untimed branch and surfacing
 * as a floating card "after the airport transfer."
 *
 * §15z now drops ANY untimed non-logistics, non-locked, non-exempt card on a
 * departure day, regardless of category. Universal-locking exemptions remain.
 *
 * Memory: mem://constraints/itinerary/canonical-time-field-promotion
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceDepartureDayLogistics } from '../pipeline/repair-day.ts';

const baseInput = {
  dayNumber: 3,
  hotelName: 'The Ritz-Carlton Kyoto',
  hotelAddress: 'Kamogawa Nijo-Ohashi Hotori',
  returnDepartureTime24: '17:30',
  airportTransferMinutes: 75,
  isLastDay: true,
};

Deno.test('M-Katsukura — untimed mislabeled-as-cultural restaurant pruned on departure day', () => {
  const activities = [
    { id: 'breakfast', title: 'Breakfast at hotel', startTime: '08:00', endTime: '09:00', category: 'dining' },
    { id: 'checkout',  title: 'Checkout',           startTime: '10:30', endTime: '11:00', category: 'accommodation' },
    // The bug shape: real restaurant, no time, category mislabeled.
    { id: 'katsukura', title: 'Katsukura Sanjo Honten', category: 'cultural' },
  ];

  const out = enforceDepartureDayLogistics({
    ...baseInput,
    activities,
    lockedIds: new Set<string>(),
  });

  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('katsukura'), false, 'untimed non-dining-tagged restaurant must be pruned');
  assertEquals(
    out.repairs.some(r => (r as any).action === 'final_enforce_dropped_untimed_activity'),
    true,
    'expected final_enforce_dropped_untimed_activity repair entry',
  );
});

Deno.test('M-Katsukura — userAdded untimed card survives the prune (universal locking)', () => {
  const activities = [
    { id: 'breakfast', title: 'Breakfast at hotel', startTime: '08:00', endTime: '09:00', category: 'dining' },
    { id: 'checkout',  title: 'Checkout',           startTime: '10:30', endTime: '11:00', category: 'accommodation' },
    { id: 'katsukura', title: 'Katsukura Sanjo Honten', category: 'cultural', userAdded: true },
  ];

  const out = enforceDepartureDayLogistics({
    ...baseInput,
    activities,
    lockedIds: new Set<string>(),
  });

  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('katsukura'), true, 'userAdded card must survive the prune');
});
