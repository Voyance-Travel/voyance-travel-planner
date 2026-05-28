// Deterministic unit tests for the Trip Planner LLM module.
// We do NOT call the gateway in tests — we only test schema validation,
// prompt construction, and the cross-check filter.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  TripPlanSchema,
  __buildPlannerPrompt,
  callTripPlannerLLM,
  type TripPlannerInput,
} from './trip-planner-llm.ts';
import type { SkeletonDay } from './schema-generation.ts';

function mkSkeleton(dayNumber: number, slotIds: string[]): SkeletonDay {
  return {
    dayNumber,
    dayType: 'standard',
    patternGroup: 'balanced',
    archetypeName: 'test',
    destination: 'Rome',
    date: '2026-06-0' + dayNumber,
    slots: slotIds.map((id, i) => ({
      slotId: id,
      slotType: 'activity' as const,
      status: 'empty' as const,
      required: false,
      position: i,
      timeWindow: { earliest: '09:00', latest: '21:00', duration: { min: 60, max: 120 } },
    })),
    constraints: {
      dayStartTime: '09:00',
      dayEndTime: '22:00',
      maxActivitySlots: 5,
      mealWeight: 'standard',
      bufferMinutes: 30,
      unscheduledBlocks: 0,
      eveningSlots: 1,
    },
  };
}

Deno.test('TripPlanSchema accepts the canonical shape', () => {
  const res = TripPlanSchema.safeParse({
    dayAssignments: [
      {
        dayNumber: 1,
        neighborhood: 'Trastevere',
        mustDoSlots: [{ slotId: 'd1-activity-1', mustDoRef: 'md-1' }],
      },
    ],
    omitted: [
      { mustDoTitle: 'Pantheon', reason: 'not_enough_time', suggestion: 'Try Day 2 morning' },
    ],
  });
  assert(res.success, 'should accept canonical plan');
});

Deno.test('TripPlanSchema rejects unknown omitted reason', () => {
  const res = TripPlanSchema.safeParse({
    dayAssignments: [],
    omitted: [{ mustDoTitle: 'X', reason: 'made_up' }],
  });
  assert(!res.success, 'should reject made-up reason');
});

Deno.test('buildPrompt includes every slotId and must-do title', () => {
  const skeletons = [mkSkeleton(1, ['d1-activity-1', 'd1-meal-1']), mkSkeleton(2, ['d2-activity-1'])];
  const input: TripPlannerInput = {
    destination: 'Rome',
    totalDays: 2,
    skeletons,
    mustDos: [
      { id: 'md-1', title: 'Colosseum', category: 'sightseeing' },
      { id: 'md-2', title: 'Trevi Fountain' },
    ],
  };
  const p = __buildPlannerPrompt(input);
  for (const id of ['d1-activity-1', 'd1-meal-1', 'd2-activity-1']) {
    assert(p.includes(id), `prompt missing slotId ${id}`);
  }
  assert(p.includes('Colosseum'), 'prompt missing Colosseum');
  assert(p.includes('Trevi Fountain'), 'prompt missing Trevi Fountain');
  assert(p.includes('Rome'), 'prompt missing destination');
});

Deno.test('callTripPlannerLLM short-circuits on no must-dos', async () => {
  const result = await callTripPlannerLLM({
    destination: 'Rome',
    totalDays: 2,
    skeletons: [mkSkeleton(1, ['d1-x'])],
    mustDos: [],
  });
  assertEquals(result.ok, true);
  assertEquals(result.plan?.dayAssignments.length, 0);
  assertEquals(result.plan?.omitted.length, 0);
});

Deno.test('callTripPlannerLLM returns ok:false when API key missing and work to do', async () => {
  const old = Deno.env.get('LOVABLE_API_KEY');
  Deno.env.delete('LOVABLE_API_KEY');
  try {
    const result = await callTripPlannerLLM({
      destination: 'Rome',
      totalDays: 1,
      skeletons: [mkSkeleton(1, ['d1-x'])],
      mustDos: [{ id: 'md-1', title: 'Colosseum' }],
    });
    assertEquals(result.ok, false);
    assert(result.error?.includes('LOVABLE_API_KEY'));
  } finally {
    if (old) Deno.env.set('LOVABLE_API_KEY', old);
  }
});
