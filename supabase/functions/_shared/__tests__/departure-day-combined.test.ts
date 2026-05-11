/**
 * M2 combined departure-day regression test.
 *
 * Constructs a Day N final-day shape that simultaneously violates all three
 * known failures the §15z enforcement layer is designed to catch:
 *   - Late checkout (14:00) — must be retimed ≤ cap
 *   - Untimed airport transfer (no startTime) — must be timed to dep − buffer
 *   - Post-transfer dinner (19:30) — must be pruned (non-locked)
 *
 * Reviewer addendum (round 2): also asserts the surviving activity ORDER
 * (lunch < checkout < transfer) so any future reorder regression fails here.
 *
 * Plus a second case verifying universal locking — a userLocked dinner after
 * the transfer survives the prune even though it violates departure logistics.
 *
 * Memory:
 *   mem://constraints/itinerary/departure-day-final-enforcement
 *   mem://features/itinerary/universal-locking-and-persistence-protocol
 */
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { enforceDepartureDayLogistics } from '../../generate-itinerary/pipeline/repair-day.ts';

function makeBaseDay() {
  return [
    { id: 'lunch',    title: 'Lunch at El Sur',          startTime: '13:00', endTime: '14:00', category: 'dining' },
    { id: 'checkout', title: 'Checkout from hotel',      startTime: '14:00', endTime: '14:30', category: 'accommodation' },
    { id: 'transfer', title: 'Transfer to Madrid Airport',                                          category: 'transport' },
    { id: 'dinner',   title: 'Dinner at Coque',          startTime: '19:30', endTime: '21:30', category: 'dining' },
  ];
}

const baseInput = {
  dayNumber: 5,
  hotelName: 'Mandarin Oriental Ritz Madrid',
  hotelAddress: 'Plaza de la Lealtad, 5',
  returnDepartureTime24: '18:00', // 18:00 flight
  airportTransferMinutes: 45,
  isLastDay: true,
  lockedIds: new Set<string>(),
};

Deno.test('M2 combined — late checkout + untimed transfer + post-transfer dinner all repaired in one pass', () => {
  const out = enforceDepartureDayLogistics({ ...baseInput, activities: makeBaseDay() });

  const ids = out.activities.map(a => a.id);
  const checkoutIdx = ids.indexOf('checkout');
  const transferIdx = ids.indexOf('transfer');
  const lunchIdx = ids.indexOf('lunch');
  const dinnerIdx = ids.indexOf('dinner');

  // 1. Checkout retimed ≤ 11:00 AND ≤ dep(18:00=1080) − buffer(180) − transfer(45) − pre(60) − dur(30)
  //    = 1080 − 315 = 765 min = 12:45 → capped to 11:00 by HARD cap.
  const checkout = out.activities[checkoutIdx];
  const [coH, coM] = String(checkout.startTime).split(':').map(Number);
  assertEquals(coH * 60 + coM <= 11 * 60, true, `checkout startTime ${checkout.startTime} should be ≤ 11:00`);

  // 2. Transfer ends at dep − buffer = 18:00 − 180m = 15:00.
  const transfer = out.activities[transferIdx];
  assertEquals(transfer.endTime, '15:00');
  assertEquals(typeof transfer.startTime, 'string');
  assertEquals(transfer.startTime.length > 0, true);

  // 3. Post-transfer dinner pruned (non-locked).
  assertEquals(dinnerIdx, -1, 'post-transfer non-locked dinner should be pruned');

  // 4. Reviewer addendum — activity order: lunch < checkout < transfer.
  assertEquals(lunchIdx >= 0 && checkoutIdx >= 0 && transferIdx >= 0, true);
  assertEquals(lunchIdx < checkoutIdx, true, `lunch (idx ${lunchIdx}) must come before checkout (idx ${checkoutIdx})`);
  assertEquals(checkoutIdx < transferIdx, true, `checkout (idx ${checkoutIdx}) must come before transfer (idx ${transferIdx})`);

  // 5. Sanity — at least one repair was recorded.
  assertEquals(out.repairs.length > 0, true);
});

Deno.test('M2 combined — locked post-transfer dinner survives prune (universal locking)', () => {
  const day = makeBaseDay();
  // Mark the dinner as user-locked.
  day[3] = { ...day[3], metadata: { userLocked: true } } as any;

  const out = enforceDepartureDayLogistics({ ...baseInput, activities: day });
  const ids = out.activities.map(a => a.id);
  const checkoutIdx = ids.indexOf('checkout');
  const transferIdx = ids.indexOf('transfer');
  const lunchIdx = ids.indexOf('lunch');
  const dinnerIdx = ids.indexOf('dinner');

  // Locked dinner survives.
  assertEquals(dinnerIdx >= 0, true, 'locked dinner must survive the post-transfer prune');

  // Checkout/transfer still retimed.
  const checkout = out.activities[checkoutIdx];
  const [coH, coM] = String(checkout.startTime).split(':').map(Number);
  assertEquals(coH * 60 + coM <= 11 * 60, true);
  const transfer = out.activities[transferIdx];
  assertEquals(transfer.endTime, '15:00');

  // Order still holds for the logistics chain (lunch < checkout < transfer).
  assertEquals(lunchIdx < checkoutIdx, true);
  assertEquals(checkoutIdx < transferIdx, true);
});
