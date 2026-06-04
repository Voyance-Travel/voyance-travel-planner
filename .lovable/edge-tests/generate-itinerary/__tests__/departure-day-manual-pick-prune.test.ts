/**
 * Regression: system-injected `preserveAsManualPick` meal sentinels must
 * NOT survive on departure days when their hard-coded slot lands at/after
 * the airport-transfer cutoff (or the row has no placeable time). This was
 * the root cause of the 12/12 "floating dining card after the airport
 * transfer placeholder" leak across Faro/Bruges/Milan/Mallorca/HK/CDMX/
 * SJU/Montreal/Casablanca/Kyoto/Osaka/Amsterdam.
 *
 * The §15z exemption is intentionally narrowed:
 *   - userAdded/userEdited/isManual/extracted/pinned + lock signals → fully exempt (sacred)
 *   - metadata.preserveAsManualPick → exempt only when the row has a
 *     placeable time AND that start sits before cutoffMin
 *
 * Memory: mem://constraints/itinerary/departure-day-save-time-enforcement
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceDepartureDayLogistics } from '../pipeline/repair-day.ts';

const baseInput = {
  dayNumber: 5,
  hotelName: 'Hotel Test',
  hotelAddress: '1 Test Street',
  airportTransferMinutes: 45,
  isLastDay: true,
};

Deno.test('Manual-pick dinner sentinel at 19:30 on a 21:00 flight is pruned', () => {
  // 21:00 flight − 180m flight buffer − 45m transfer = transfer starts ~17:15.
  // §15z cutoffMin = transfer start = 17:15. Dinner sentinel @ 19:30 ≥ cutoff → drop.
  const activities = [
    { id: 'breakfast', title: 'Breakfast at hotel', startTime: '08:00', endTime: '09:00', category: 'dining' },
    { id: 'checkout', title: 'Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
    {
      id: 'dinner-sentinel',
      title: 'Dinner — find a local spot in Kyoto',
      startTime: '19:30',
      endTime: '21:00',
      category: 'dining',
      metadata: { preserveAsManualPick: true, needsVenuePick: true },
    },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    returnDepartureTime24: '21:00',
    activities,
    lockedIds: new Set<string>(),
  });
  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('dinner-sentinel'), false, 'preserveAsManualPick post-cutoff sentinel must be pruned');
});

Deno.test('Manual-pick lunch sentinel at 12:30 on a 14:00 flight is pruned', () => {
  // 14:00 − 180m − 45m = transfer ~10:15. Lunch @ 12:30 ≥ cutoff → drop.
  const activities = [
    { id: 'breakfast', title: 'Breakfast', startTime: '08:00', endTime: '09:00', category: 'dining' },
    {
      id: 'lunch-sentinel',
      title: 'Lunch — find a local spot in Faro',
      startTime: '12:30',
      endTime: '13:30',
      category: 'dining',
      metadata: { preserveAsManualPick: true, needsVenuePick: true },
    },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    returnDepartureTime24: '14:00',
    activities,
    lockedIds: new Set<string>(),
  });
  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('lunch-sentinel'), false, 'preserveAsManualPick post-cutoff lunch must be pruned');
});

Deno.test('Manual-pick breakfast sentinel at 08:30 on a 22:00 flight survives (fits before cutoff)', () => {
  // 22:00 − 180m − 45m = transfer ~18:15. Breakfast @ 08:30 < cutoff → keep.
  const activities = [
    {
      id: 'breakfast-sentinel',
      title: 'Breakfast — find a local spot in Lisbon',
      startTime: '08:30',
      endTime: '09:30',
      category: 'dining',
      metadata: { preserveAsManualPick: true, needsVenuePick: true },
    },
    { id: 'checkout', title: 'Checkout', startTime: '11:00', endTime: '11:15', category: 'accommodation' },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    returnDepartureTime24: '22:00',
    activities,
    lockedIds: new Set<string>(),
  });
  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('breakfast-sentinel'), true, 'preserveAsManualPick sentinel before cutoff must survive');
});

Deno.test('userAdded untimed dining row on departure day still survives (sacred)', () => {
  const activities = [
    { id: 'checkout', title: 'Checkout', startTime: '10:00', endTime: '10:15', category: 'accommodation' },
    {
      id: 'user-dining',
      title: 'My picked sushi spot',
      category: 'dining',
      userAdded: true,
    },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    returnDepartureTime24: '17:00',
    activities,
    lockedIds: new Set<string>(),
  });
  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('user-dining'), true, 'userAdded row must survive untouched');
});

Deno.test('Untimed preserveAsManualPick sentinel is pruned regardless of flight time', () => {
  const activities = [
    { id: 'checkout', title: 'Checkout', startTime: '10:00', endTime: '10:15', category: 'accommodation' },
    {
      id: 'untimed-sentinel',
      title: 'Lunch — find a local spot in Bruges',
      category: 'dining',
      metadata: { preserveAsManualPick: true, needsVenuePick: true },
    },
  ];
  const out = enforceDepartureDayLogistics({
    ...baseInput,
    returnDepartureTime24: '20:00',
    activities,
    lockedIds: new Set<string>(),
  });
  const ids = out.activities.map(a => a.id);
  assertEquals(ids.includes('untimed-sentinel'), false, 'untimed preserveAsManualPick sentinel must be pruned');
});
