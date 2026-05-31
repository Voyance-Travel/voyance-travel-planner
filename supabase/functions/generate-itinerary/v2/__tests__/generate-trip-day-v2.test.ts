/**
 * Phase B smoke test — feature flag default + shape contract.
 *
 * Does NOT exercise the AI / DB pipeline. Confirms:
 *  - shouldUseV2Chain returns false when metadata is absent / wrong shape.
 *  - shouldUseV2Chain returns true only when `metadata.useV2Chain === true`.
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

Deno.test('shouldUseV2Chain: defaults to false', async () => {
  assertEquals(await shouldUseV2Chain(mkSupabase(null), 'trip-1'), false);
  assertEquals(await shouldUseV2Chain(mkSupabase({}), 'trip-1'), false);
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV2Chain: 'true' }), 'trip-1'), false);
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV2Chain: 1 }), 'trip-1'), false);
});

Deno.test('shouldUseV2Chain: opt-in via boolean true only', async () => {
  assertEquals(await shouldUseV2Chain(mkSupabase({ useV2Chain: true }), 'trip-1'), true);
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
