// Unit tests for the Slot Filler LLM module — no real gateway call.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  buildSlotPackets,
  SlotFillerResponseSchema,
  fillDaySkeleton,
  mergeFillsIntoSkeleton,
  __buildFillerPrompt,
} from './slot-filler-llm.ts';
import type { SkeletonDay } from './schema-generation.ts';

function mkSkeleton(): SkeletonDay {
  return {
    dayNumber: 2,
    dayType: 'standard',
    patternGroup: 'balanced',
    archetypeName: 'gastronome',
    destination: 'Madrid',
    date: '2026-06-02',
    slots: [
      {
        slotId: 'd2-meal-1',
        slotType: 'meal',
        status: 'empty',
        required: true,
        position: 0,
        timeWindow: { earliest: '08:00', latest: '10:00', duration: { min: 45, max: 75 } },
        mealType: 'breakfast',
        aiInstruction: 'Name a real breakfast venue in Madrid.',
      },
      {
        slotId: 'd2-mustdo-1',
        slotType: 'must_do',
        status: 'empty',
        required: true,
        position: 1,
        timeWindow: { earliest: '10:00', latest: '13:00', duration: { min: 90, max: 120 } },
        mustDoRef: 'mustdo-1',
        aiInstruction: 'MUST schedule: Prado Museum.',
      },
      {
        slotId: 'd2-arrival-1',
        slotType: 'arrival',
        status: 'filled',
        required: true,
        position: 2,
        timeWindow: {
          earliest: '07:00',
          latest: '07:00',
          duration: { min: 60, max: 60 },
        },
        filledData: {
          title: 'Arrival',
          category: 'transport',
          startTime: '07:00',
          endTime: '08:00',
          source: 'flight_data',
        },
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

Deno.test('buildSlotPackets returns only empty slots with windows + instructions', () => {
  const packets = buildSlotPackets({ skeleton: mkSkeleton(), mustDoTitlesById: { 'mustdo-1': 'Prado Museum' } });
  assertEquals(packets.length, 2);
  assertEquals(packets[0].slotId, 'd2-meal-1');
  assertEquals(packets[0].mealType, 'breakfast');
  assertEquals(packets[0].timeWindow?.earliest, '08:00');
  assertEquals(packets[1].mustDoTitle, 'Prado Museum');
  assert(packets[1].aiInstruction.includes('Prado Museum'));
});

Deno.test('SlotFillerResponseSchema rejects unknown fields and time-shaped data', () => {
  const bad = {
    fills: [
      {
        slotId: 'x',
        name: 'y',
        description: 'z',
        startTime: '09:00', // forbidden
      },
    ],
  };
  assert(!SlotFillerResponseSchema.safeParse(bad).success);

  const good = { fills: [{ slotId: 'x', name: 'y', description: 'z' }] };
  assert(SlotFillerResponseSchema.safeParse(good).success);
});

Deno.test('fillDaySkeleton skips network when no empty slots exist', async () => {
  const skel = mkSkeleton();
  // Mark all empty slots filled.
  for (const s of skel.slots) {
    if (s.status === 'empty') {
      s.status = 'filled';
      s.filledData = {
        title: 'x',
        category: 'meal',
        startTime: '09:00',
        endTime: '10:00',
        source: 'system',
      };
    }
  }
  const result = await fillDaySkeleton({ skeleton: skel });
  assert(result.ok);
  assertEquals(result.response?.fills.length, 0);
  assertEquals(result.attempts, 0);
});

Deno.test('fillDaySkeleton parses well-formed JSON and drops unknown slotIds', async () => {
  const skel = mkSkeleton();
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                fills: [
                  { slotId: 'd2-meal-1', name: 'Café Comercial', description: 'Historic Madrid café for churros and chocolate.' },
                  { slotId: 'unknown-slot', name: 'X', description: 'Y' },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const result = await fillDaySkeleton(
    { skeleton: skel, mustDoTitlesById: { 'mustdo-1': 'Prado Museum' } },
    { apiKey: 'test', fetchImpl: fakeFetch },
  );
  assert(result.ok, `expected ok, got ${result.error}`);
  assertEquals(calls, 1);
  assertEquals(result.response?.fills.length, 1);
  assertEquals(result.response?.fills[0].slotId, 'd2-meal-1');
  // Mustdo slot was sent but not fulfilled by stub → reported unfilled.
  assert(result.unfilledSlotIds.includes('d2-mustdo-1'));
});

Deno.test('fillDaySkeleton retries once on parse failure then reports error', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'not-json at all' } }] }),
      { status: 200 },
    );
  };
  const result = await fillDaySkeleton(
    { skeleton: mkSkeleton() },
    { apiKey: 'test', fetchImpl: fakeFetch },
  );
  assert(!result.ok);
  assertEquals(calls, 2);
  assertEquals(result.attempts, 2);
});

Deno.test('mergeFillsIntoSkeleton fills empty slots with clamped duration and preserves filled ones', () => {
  const skel = mkSkeleton();
  const merged = mergeFillsIntoSkeleton(skel, [
    { slotId: 'd2-meal-1', name: 'Café Comercial', description: 'Churros con chocolate.', durationMin: 9999 },
  ]);
  const meal = merged.slots.find((s) => s.slotId === 'd2-meal-1')!;
  assertEquals(meal.status, 'filled');
  assertEquals(meal.filledData?.title, 'Café Comercial');
  assertEquals(meal.filledData?.startTime, '08:00');
  // Duration clamped to window max (75 min) → end 09:15.
  assertEquals(meal.filledData?.endTime, '09:15');
  // Pre-pinned arrival untouched.
  const arr = merged.slots.find((s) => s.slotId === 'd2-arrival-1')!;
  assertEquals(arr.filledData?.title, 'Arrival');
});

Deno.test('prompt names every empty slotId verbatim', () => {
  const skel = mkSkeleton();
  const packets = buildSlotPackets({ skeleton: skel });
  const prompt = __buildFillerPrompt({ skeleton: skel }, packets);
  assert(prompt.includes('d2-meal-1'));
  assert(prompt.includes('d2-mustdo-1'));
  // Filled slot must NOT appear in the empty-slot list.
  assert(!prompt.includes('d2-arrival-1'));
});
