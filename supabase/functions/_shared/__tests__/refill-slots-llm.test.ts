// Unit tests for the Refill Slots LLM module.

import { assert, assertEquals } from 'jsr:@std/assert@1';
import {
  buildRefillPrompt,
  refillDroppedSlots,
  RefillResponseSchema,
} from '../refill-slots-llm.ts';
import type { NeedsRefillEntry } from '../itinerary-cleanup.ts';

function mkNeeds(): NeedsRefillEntry[] {
  return [
    {
      slotId: 'd3-lunch-1',
      slotType: 'meal',
      mealType: 'lunch',
      timeWindow: { startTime: '12:30', endTime: '13:30' },
      neighborhood: 'Salamanca',
      reason: 'cross_city_venue',
      droppedTitle: "All'Antico Vinaio",
    },
  ];
}

Deno.test('buildRefillPrompt: includes destination, slot list, and JSON contract', () => {
  const prompt = buildRefillPrompt({ destination: 'Madrid', needsRefill: mkNeeds() });
  assert(prompt.includes('Madrid'));
  assert(prompt.includes('d3-lunch-1'));
  assert(prompt.includes('strict JSON'));
  assert(prompt.includes('venueAddress'));
});

Deno.test('buildRefillPrompt: includes context venues + used-venues exclusion', () => {
  const prompt = buildRefillPrompt({
    destination: 'Madrid',
    needsRefill: mkNeeds(),
    contextVenues: { before: 'Prado Museum', after: 'Retiro Park' },
    usedVenues: ['DiverXO', 'Botin'],
  });
  assert(prompt.includes('Prado Museum'));
  assert(prompt.includes('Retiro Park'));
  assert(prompt.includes('DiverXO'));
});

Deno.test('RefillResponseSchema: rejects time/category/price fields (strict)', () => {
  const bad = { fills: [{ slotId: 'x', name: 'V', description: 'd', startTime: '12:30' }] };
  const r = RefillResponseSchema.safeParse(bad);
  assertEquals(r.success, false);
});

Deno.test('RefillResponseSchema: accepts valid minimal fill', () => {
  const ok = { fills: [{ slotId: 'x', name: 'V', description: 'd' }] };
  const r = RefillResponseSchema.safeParse(ok);
  assertEquals(r.success, true);
});

Deno.test('refillDroppedSlots: empty needsRefill returns ok with zero attempts', async () => {
  const r = await refillDroppedSlots(
    { destination: 'Madrid', needsRefill: [] },
    { lovableApiKey: 'fake' },
  );
  assertEquals(r.ok, true);
  assertEquals(r.attempts, 0);
  assertEquals(r.response?.fills.length, 0);
});

Deno.test('refillDroppedSlots: drops fills whose slotId is not in needsRefill', async () => {
  const fakeFetch = ((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response(
      JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              fills: [
                { slotId: 'd3-lunch-1', name: 'Casa Lucio', description: 'Classic Madrid tavern.' },
                { slotId: 'GHOST-SLOT', name: 'Phantom', description: 'should be dropped' },
              ],
            }),
          },
        }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))) as unknown as typeof fetch;

  const r = await refillDroppedSlots(
    { destination: 'Madrid', needsRefill: mkNeeds() },
    { lovableApiKey: 'fake', fetchImpl: fakeFetch },
  );
  assertEquals(r.ok, true);
  assertEquals(r.response?.fills.length, 1);
  assertEquals(r.response?.fills[0].slotId, 'd3-lunch-1');
});

Deno.test('refillDroppedSlots: returns ok=false on HTTP error', async () => {
  const fakeFetch = ((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response('boom', { status: 500 }))) as unknown as typeof fetch;
  const r = await refillDroppedSlots(
    { destination: 'Madrid', needsRefill: mkNeeds() },
    { lovableApiKey: 'fake', fetchImpl: fakeFetch },
  );
  assertEquals(r.ok, false);
  assert(r.error?.includes('500'));
  assertEquals(r.unfilledSlotIds, ['d3-lunch-1']);
});
