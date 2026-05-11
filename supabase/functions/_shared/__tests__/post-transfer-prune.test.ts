/**
 * M2 — Save-time post-airport-transfer prune (Madrid shape regression).
 * See mem://constraints/itinerary/departure-day-final-enforcement
 */
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { pruneNonLogisticsAfterAirportTransfer } from '../post-checkout-prune.ts';

Deno.test('drops post-midnight dinner after a 13:00 airport transfer (Madrid shape)', () => {
  const acts = [
    { id: '1', title: 'Brunch at Café', startTime: '10:00', endTime: '11:00', category: 'dining' },
    { id: '2', title: 'Checkout from Hotel', startTime: '11:00', endTime: '11:30', category: 'accommodation' },
    { id: '3', title: 'Transfer to Airport', startTime: '13:00', endTime: '13:45', category: 'transport', subcategory: 'airport_transfer' },
    { id: '4', title: 'Late dinner', startTime: '00:10', endTime: '02:25', category: 'dining' },
  ];
  const r = pruneNonLogisticsAfterAirportTransfer(acts);
  assertEquals(r.prunedCount, 1);
  assert(r.prunedTitles.includes('Late dinner'));
  assertEquals(acts.map((a) => a.id), ['1', '2', '3']);
});

Deno.test('preserves locked rows even when post-transfer', () => {
  const acts = [
    { id: '1', title: 'Transfer to Airport', startTime: '13:00', endTime: '13:45', category: 'transport', subcategory: 'airport_transfer' },
    { id: '2', title: 'Locked dinner', startTime: '14:00', endTime: '15:00', category: 'dining', isLocked: true },
  ];
  const r = pruneNonLogisticsAfterAirportTransfer(acts);
  assertEquals(r.prunedCount, 0);
});

Deno.test('preserves flight + airport-security cards after the transfer', () => {
  const acts = [
    { id: '1', title: 'Transfer to Airport', startTime: '13:00', endTime: '13:45', category: 'transport', subcategory: 'airport_transfer' },
    { id: '2', title: 'Airport Security & Boarding', startTime: '14:00', endTime: '15:00', category: 'transport' },
    { id: '3', title: 'Flight Departure', startTime: '15:30', endTime: '18:30', category: 'flight' },
  ];
  const r = pruneNonLogisticsAfterAirportTransfer(acts);
  assertEquals(r.prunedCount, 0);
});

Deno.test('no-op when there is no airport transfer card', () => {
  const acts = [
    { id: '1', title: 'Lunch', startTime: '12:00', endTime: '13:00', category: 'dining' },
    { id: '2', title: 'Museum', startTime: '14:00', endTime: '16:00', category: 'sightseeing' },
  ];
  const r = pruneNonLogisticsAfterAirportTransfer(acts);
  assertEquals(r.prunedCount, 0);
});
