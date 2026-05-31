/**
 * Phase D smoke test — feature flag cutover + shape contract.
 *
 * Does NOT exercise the AI / DB pipeline. Confirms:
 *  - shouldUseV2Chain defaults to TRUE (v2 is the new default after cutover).
 *  - `metadata.useV1Chain === true` kill-switch routes back to v1.
 *  - Empty tripId → false (defensive, never call v2 without a trip).
 *  - handleGenerateTripDayV2 rejects malformed input with V2_BAD_INPUT.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { handleGenerateTripDayV2, shouldUseV2Chain } from '../generate-trip-day-v2.ts';

function mkSupabase(metadata: unknown) {
  return {
    from: (_t: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { metadata }, error: null }),
        }),
      }),
    }),
  } as any;
}

Deno.test('shouldUseV2Chain: defaults to TRUE post-cutover', async () => {
  assertEquals(await shouldUseV2Chain(mkSupabase(null), 'trip-1'), true);
  assertEquals(await shouldUseV2Chain(mkSupabase({}), 'trip-1'), true);
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV2Chain: 'true' }), 'trip-1'), true);
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV2Chain: 1 }), 'trip-1'), true);
});

Deno.test('shouldUseV2Chain: useV1Chain=true kill-switch routes to v1', async () => {
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV1Chain: true }), 'trip-1'), false);
  // Only boolean true triggers kill-switch
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV1Chain: 'true' }), 'trip-1'), true);
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV1Chain: 1 }), 'trip-1'), true);
});

Deno.test('shouldUseV2Chain: missing tripId → false (no DB call)', async () => {
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV2Chain: true }), ''), false);
});


Deno.test('handleGenerateTripDayV2: rejects missing tripId', async () => {
  const res = await handleGenerateTripDayV2({} as any, 'user-1', { dayNumber: 1 });
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.code, 'V2_BAD_INPUT');
});

Deno.test('handleGenerateTripDayV2: rejects non-number dayNumber', async () => {
  const res = await handleGenerateTripDayV2({} as any, 'user-1', { tripId: 't', dayNumber: '1' });
  assertEquals(res.status, 400);
  const body = await res.json();
  assert(String(body.error).includes('dayNumber'));
});

// Phase B parity-port wiring smoke test — confirms all new helper imports
// (ledger-check, meal-guard, runStep8, nuclear sweeps, trace-recorder,
// scrubPhantomEventRefs, post-meal-guard-fill) resolve at module load.
// Regression guard against missing-import deploy failures.
Deno.test('v2 module exports both entrypoints after parity ports', async () => {
  const mod = await import('../generate-trip-day-v2.ts');
  assertEquals(typeof mod.handleGenerateTripDayV2, 'function');
  assertEquals(typeof mod.shouldUseV2Chain, 'function');
});
