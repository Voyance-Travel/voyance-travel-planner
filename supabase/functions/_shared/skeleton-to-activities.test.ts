// Unit tests for the Skeleton → DayActivity adapter.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import { skeletonToActivities } from './skeleton-to-activities.ts';
import type { SkeletonDay } from './schema-generation.ts';

function mkSkeleton(): SkeletonDay {
  return {
    dayNumber: 3,
    dayType: 'standard',
    patternGroup: 'balanced',
    archetypeName: 'gastronome',
    destination: 'Madrid',
    date: '2026-06-03',
    slots: [
      {
        slotId: 'd3-arrival-1',
        slotType: 'arrival',
        status: 'filled',
        required: true,
        position: 0,
        timeWindow: { earliest: '07:00', latest: '07:00', duration: { min: 60, max: 60 } },
        filledData: {
          title: 'Arrival',
          category: 'transport',
          startTime: '07:00',
          endTime: '08:00',
          source: 'flight_data',
        },
      },
      {
        slotId: 'd3-meal-1',
        slotType: 'meal',
        status: 'filled',
        required: true,
        position: 1,
        mealType: 'breakfast',
        timeWindow: { earliest: '08:00', latest: '10:00', duration: { min: 45, max: 75 } },
        filledData: {
          title: 'Café Comercial',
          category: '', // empty → adapter should derive 'breakfast'
          startTime: '08:30',
          endTime: '09:15',
          source: 'system',
          notes: 'Historic Madrid café.',
        },
      },
      {
        slotId: 'd3-mustdo-1',
        slotType: 'must_do',
        status: 'filled',
        required: true,
        position: 2,
        mustDoRef: 'mustdo-1',
        timeWindow: { earliest: '10:00', latest: '13:00', duration: { min: 90, max: 120 } },
        filledData: {
          title: 'Prado Museum',
          category: 'culture',
          startTime: '10:30',
          endTime: '12:30',
          source: 'must_do',
        },
      },
      {
        slotId: 'd3-evening-1',
        slotType: 'evening',
        status: 'empty', // unfilled — adapter should report it
        required: false,
        position: 3,
        timeWindow: { earliest: '19:00', latest: '22:00', duration: { min: 60, max: 120 } },
      },
    ],
    constraints: {
      dayStartTime: '08:00',
      dayEndTime: '22:00',
      maxActivitySlots: 5,
      mealWeight: 'standard',
      bufferMinutes: 30,
      unscheduledBlocks: 0,
      eveningSlots: 1,
    },
  };
}

Deno.test('skeletonToActivities maps filled slots and reports empties', () => {
  const result = skeletonToActivities(mkSkeleton());
  assertEquals(result.activities.length, 3);
  assertEquals(result.unfilledSlots.length, 1);
  assertEquals(result.unfilledSlots[0].slotId, 'd3-evening-1');
});

Deno.test('skeletonToActivities sorts by startTime', () => {
  const result = skeletonToActivities(mkSkeleton());
  assertEquals(result.activities.map((a) => a.startTime), ['07:00', '08:30', '10:30']);
});

Deno.test('skeletonToActivities derives category from slotType + mealType when filledData.category empty', () => {
  const result = skeletonToActivities(mkSkeleton());
  const meal = result.activities.find((a) => a.metadata.skeletonSlotId === 'd3-meal-1')!;
  assertEquals(meal.category, 'breakfast');
});

Deno.test('skeletonToActivities locks arrival/departure/hotel slots and preserves must_do unlocked', () => {
  const result = skeletonToActivities(mkSkeleton());
  const arr = result.activities.find((a) => a.metadata.skeletonSlotType === 'arrival')!;
  const must = result.activities.find((a) => a.metadata.skeletonSlotType === 'must_do')!;
  assertEquals(arr.isLocked, true);
  assertEquals(arr.lockSource, 'skeleton_arrival');
  assert(!must.isLocked);
  assertEquals(must.metadata.mustDoRef, 'mustdo-1');
});

Deno.test('skeletonToActivities stamps every activity with skeletonSlotId metadata', () => {
  const result = skeletonToActivities(mkSkeleton());
  for (const a of result.activities) {
    assert(a.metadata.skeletonSlotId && a.metadata.skeletonSlotId.length > 0);
    assertEquals(a.source, 'skeleton_filler');
  }
});
