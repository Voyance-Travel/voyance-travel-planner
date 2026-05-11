/**
 * Regression-protection guard tests for persistTripItinerary.
 *
 * Closes the "$924 → $340 on refresh" bug: when generation produces a
 * degraded plan (fewer real activities than what's already on disk), the
 * write must be REFUSED for itinerary_data but still allowed for status /
 * metadata so callers can flag the failed attempt.
 *
 * See mem://constraints/itinerary/no-regression-overwrite.
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { persistTripItinerary } from '../persist-itinerary.ts';

/** Build a "meaningful" sightseeing activity with a positive cost. */
function act(title: string, cost = 50) {
  return {
    title,
    category: 'sightseeing',
    startTime: '10:00',
    endTime: '12:00',
    cost: { amount: cost, currency: 'USD' },
  };
}

/** Build a fake supabase that:
 *   - returns `existingDays` + `existingMetadata` for select().eq().maybeSingle()
 *   - captures the update payload into `captured`
 */
function makeFakeSb(existingDays: any[], existingMetadata: Record<string, any> = {}) {
  const captured: { updatePayload: any } = { updatePayload: null };
  const sb = {
    from(_t: string) {
      return {
        select(_cols: string) {
          return {
            eq(_c: string, _v: any) {
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      itinerary_data: { days: existingDays },
                      metadata: existingMetadata,
                    },
                    error: null,
                  }),
              };
            },
          };
        },
        update(payload: any) {
          captured.updatePayload = payload;
          return { eq: (_c: string, _v: any) => Promise.resolve({ error: null }) };
        },
      };
    },
  };
  return { sb, captured };
}

Deno.test('regression: healthy old (12 meaningful) → degraded new (3) is BLOCKED', async () => {
  const oldDays = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('A4')] },
    { dayNumber: 2, activities: [act('B1'), act('B2'), act('B3'), act('B4')] },
    { dayNumber: 3, activities: [act('C1'), act('C2'), act('C3'), act('C4')] },
  ];
  const newDays = [
    { dayNumber: 1, activities: [act('A1')] },
    { dayNumber: 2, activities: [act('B1')] },
    { dayNumber: 3, activities: [act('C1')] },
  ];
  const { sb, captured } = makeFakeSb(oldDays);
  const { error, regressionBlocked } = await persistTripItinerary(
    sb as any,
    't1',
    { days: newDays },
    {
      label: 'test-regress',
      extraUpdate: { itinerary_status: 'failed' },
    },
  );
  assertEquals(error, null);
  assertEquals(regressionBlocked, true);
  // itinerary_data must NOT be in the update payload
  assertEquals('itinerary_data' in captured.updatePayload, false);
  // status still applied
  assertEquals(captured.updatePayload.itinerary_status, 'failed');
  // rejected_attempts ring buffer stamped
  const rejected = captured.updatePayload.metadata?.rejected_attempts;
  assertEquals(Array.isArray(rejected), true);
  assertEquals(rejected.length, 1);
  assertEquals(rejected[0].reason, 'regression_blocked');
});

Deno.test('initial generation: old is empty → new with 10 activities PROCEEDS', async () => {
  const newDays = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('A4'), act('A5')] },
    { dayNumber: 2, activities: [act('B1'), act('B2'), act('B3'), act('B4'), act('B5')] },
  ];
  const { sb, captured } = makeFakeSb([]); // no existing days
  const { error, regressionBlocked } = await persistTripItinerary(
    sb as any,
    't1',
    { days: newDays },
    { label: 'test-initial' },
  );
  assertEquals(error, null);
  assertEquals(regressionBlocked, false);
  // itinerary_data MUST be written
  assertEquals(captured.updatePayload.itinerary_data.days.length, 2);
});

Deno.test('small drop within tolerance: 10 → 9 PROCEEDS', async () => {
  const oldDays = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('A4'), act('A5')] },
    { dayNumber: 2, activities: [act('B1'), act('B2'), act('B3'), act('B4'), act('B5')] },
  ];
  const newDays = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('A4'), act('A5')] },
    { dayNumber: 2, activities: [act('B1'), act('B2'), act('B3'), act('B4')] },
  ];
  const { sb, captured } = makeFakeSb(oldDays);
  const { regressionBlocked } = await persistTripItinerary(
    sb as any,
    't1',
    { days: newDays },
    { label: 'test-tolerance' },
  );
  // 9 >= max(3, floor(10*0.6)=6) → write proceeds
  assertEquals(regressionBlocked, false);
  assertEquals(captured.updatePayload.itinerary_data.days.length, 2);
});

Deno.test('allowRegression=true overrides the guard', async () => {
  const oldDays = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('A4'), act('A5')] },
    { dayNumber: 2, activities: [act('B1'), act('B2'), act('B3'), act('B4'), act('B5')] },
  ];
  const newDays = [{ dayNumber: 1, activities: [act('A1')] }];
  const { sb, captured } = makeFakeSb(oldDays);
  const { regressionBlocked } = await persistTripItinerary(
    sb as any,
    't1',
    { days: newDays },
    { label: 'test-override', allowRegression: true },
  );
  assertEquals(regressionBlocked, false);
  assertEquals(captured.updatePayload.itinerary_data.days.length, 1);
});

Deno.test('rejected_attempts ring buffer caps at 3 entries', async () => {
  const oldDays = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('A4'), act('A5')] },
    { dayNumber: 2, activities: [act('B1'), act('B2'), act('B3'), act('B4'), act('B5')] },
  ];
  // Pre-load metadata with 3 prior rejections
  const priorRejected = [
    { at: 't1', reason: 'regression_blocked' },
    { at: 't2', reason: 'regression_blocked' },
    { at: 't3', reason: 'regression_blocked' },
  ];
  const { sb, captured } = makeFakeSb(oldDays, { rejected_attempts: priorRejected });
  const newDays = [{ dayNumber: 1, activities: [act('A1')] }];
  await persistTripItinerary(
    sb as any,
    't1',
    { days: newDays },
    { label: 'test-ring' },
  );
  const rejected = captured.updatePayload.metadata.rejected_attempts;
  assertEquals(rejected.length, 3); // capped
  // Newest entry is at the tail
  assertEquals(rejected[2].label, 'test-ring');
  // Oldest dropped
  assertEquals(rejected[0].at, 't2');
});
