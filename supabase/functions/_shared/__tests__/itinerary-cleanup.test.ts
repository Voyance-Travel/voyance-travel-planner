// Unit tests for the deterministic itinerary-cleanup boundary.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { cleanupDay } from '../itinerary-cleanup.ts';
import type { AdapterActivity } from '../skeleton-to-activities.ts';

function mk(
  partial: Partial<AdapterActivity> & { id: string; title: string; startTime: string; endTime: string; category: string },
): AdapterActivity {
  return {
    name: partial.title,
    description: partial.description ?? '',
    source: partial.source ?? 'skeleton_filler',
    metadata: { skeletonSlotId: partial.id, skeletonSlotType: 'activity', ...(partial.metadata ?? {}) },
    ...partial,
  } as AdapterActivity;
}

Deno.test('cleanupDay: stable chrono sort with late-nightlife wrap', () => {
  const acts: AdapterActivity[] = [
    mk({ id: 's2', title: 'Late Bar', startTime: '00:45', endTime: '01:30', category: 'evening' }),
    mk({ id: 's1', title: 'Dinner', startTime: '20:00', endTime: '21:30', category: 'dinner' }),
  ];
  const out = cleanupDay(acts);
  assertEquals(out.activities.map((a) => a.id), ['s1', 's2']);
});

Deno.test('cleanupDay: collapses adjacent breakfast rows and flags refill', () => {
  const acts: AdapterActivity[] = [
    mk({
      id: 'b1', title: 'Café Lila', startTime: '08:00', endTime: '08:45', category: 'breakfast',
      metadata: { skeletonSlotId: 'b1', skeletonSlotType: 'meal', mealType: 'breakfast' },
    }),
    mk({
      id: 'b2', title: 'Maison Eric Kayser', startTime: '09:00', endTime: '09:45', category: 'breakfast',
      metadata: { skeletonSlotId: 'b2', skeletonSlotType: 'meal', mealType: 'breakfast' },
    }),
  ];
  const out = cleanupDay(acts);
  assertEquals(out.activities.length, 1);
  assertEquals(out.activities[0].id, 'b1');
  assertEquals(out.ops.duplicate_meal_slot, 1);
  assertEquals(out.needsRefill[0].reason, 'duplicate_meal_slot');
  assertEquals(out.needsRefill[0].slotId, 'b2');
});

Deno.test('cleanupDay: drops nightcap in a breakfast slot', () => {
  const acts: AdapterActivity[] = [
    mk({
      id: 'b1', title: 'Nightcap at Quadri', startTime: '08:30', endTime: '09:30', category: 'breakfast',
      metadata: { skeletonSlotId: 'b1', skeletonSlotType: 'meal', mealType: 'breakfast' },
    }),
  ];
  const out = cleanupDay(acts);
  assertEquals(out.activities.length, 0);
  assertEquals(out.ops.category_slot_mismatch, 1);
});

Deno.test('cleanupDay: NEVER drops locked rows even if cross-city / mismatched', () => {
  const acts: AdapterActivity[] = [
    mk({
      id: 'a1', title: 'Required Booked Tour', startTime: '10:00', endTime: '12:00', category: 'breakfast',
      isLocked: true, source: 'user',
      metadata: { skeletonSlotId: 'a1', skeletonSlotType: 'meal', mealType: 'breakfast' },
    }),
  ];
  const out = cleanupDay(acts, {
    isCrossCityVenue: () => true,
    distanceMeters: () => 9999,
  });
  assertEquals(out.activities.length, 1);
  assertEquals(out.needsRefill.length, 0);
});

Deno.test('cleanupDay: drops cross-city venue via caller matcher', () => {
  const acts: AdapterActivity[] = [
    mk({ id: 'a1', title: 'Anchor', startTime: '09:00', endTime: '10:00', category: 'activity' }),
    mk({ id: 'a2', title: "All'Antico Vinaio (Florence)", startTime: '12:00', endTime: '13:00', category: 'lunch' }),
  ];
  const out = cleanupDay(acts, {
    isCrossCityVenue: (a) => /florence/i.test(a.title),
  });
  assertEquals(out.activities.length, 1);
  assertEquals(out.ops.cross_city_venue, 1);
  assertEquals(out.needsRefill[0].reason, 'cross_city_venue');
});

Deno.test('cleanupDay: drops transit-too-far on luxury tier (>1000m)', () => {
  const acts: AdapterActivity[] = [
    mk({ id: 'a1', title: 'Anchor', startTime: '09:00', endTime: '10:00', category: 'activity' }),
    mk({ id: 'a2', title: 'Far Restaurant', startTime: '13:00', endTime: '14:00', category: 'lunch' }),
    mk({ id: 'a3', title: 'Next Anchor', startTime: '15:00', endTime: '16:00', category: 'activity' }),
  ];
  const out = cleanupDay(acts, {
    budgetTier: 'luxury',
    distanceMeters: (x, y) => (x.id === 'a1' && y.id === 'a2') ? 2500 : 200,
  });
  // a2 should be dropped because distance from a1 > 1000m
  assertEquals(out.activities.length, 2);
  assertEquals(out.activities.map((a) => a.id), ['a1', 'a3']);
  assertEquals(out.ops.transit_too_far, 1);
});

Deno.test('cleanupDay: empty input is a no-op', () => {
  const out = cleanupDay([]);
  assertEquals(out.activities.length, 0);
  assertEquals(out.needsRefill.length, 0);
  assert(Object.values(out.ops).every((n) => n === 0));
});
