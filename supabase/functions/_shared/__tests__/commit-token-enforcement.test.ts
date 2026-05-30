/**
 * Phase 3 — commit-token end-to-end enforcement.
 *
 * Verifies:
 *  1. persistTripItinerary stamps metadata.quality.commit_token_audit on
 *     every ready/generated/frozen write (audit-only by default).
 *  2. With env COMMIT_TOKEN_STRICT=true, a ready claim without a valid
 *     token is demoted to partial BEFORE the re-gate.
 *  3. A token minted by mintCommitToken against the SAME days passes
 *     verifyCommitToken (round-trip).
 */

import { assertEquals, assert } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { persistTripItinerary } from '../persist-itinerary.ts';
import { mintCommitToken, verifyCommitToken } from '../commit-token.ts';

function act(title: string, cost = 50) {
  return {
    title,
    category: 'sightseeing',
    startTime: '10:00',
    endTime: '12:00',
    cost: { amount: cost, currency: 'USD' },
  };
}

function makeFakeSb(existingDays: any[] = []) {
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
                    data: { itinerary_data: { days: existingDays }, metadata: {} },
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

Deno.test('commit-token: round-trip mint→verify against same days passes', async () => {
  const days = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3')] },
  ];
  const token = await mintCommitToken('trip-x', days);
  const v = await verifyCommitToken(token, 'trip-x', days);
  assertEquals(v.ok, true);
});

Deno.test('commit-token: tampered days fail verification with content-mismatch', async () => {
  const days = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3')] },
  ];
  const token = await mintCommitToken('trip-x', days);
  const tampered = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3'), act('SNUCK_IN')] },
  ];
  const v = await verifyCommitToken(token, 'trip-x', tampered);
  assertEquals(v.ok, false);
  assertEquals(v.reason, 'content-mismatch');
});

Deno.test('persist: stamps commit_token_audit=missing on ready-claim without token', async () => {
  const days = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3')] },
  ];
  const { sb, captured } = makeFakeSb(days);
  await persistTripItinerary(sb as any, 'trip-x', { days }, {
    label: 'test',
    extraUpdate: { itinerary_status: 'ready' },
  });
  const audit = captured.updatePayload?.metadata?.quality?.commit_token_audit;
  assert(audit, 'expected commit_token_audit to be stamped');
  assertEquals(audit.result, 'missing');
  assertEquals(audit.strict, false);
});

Deno.test('persist: stamps commit_token_audit=verified when matching token forwarded', async () => {
  const days = [
    { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3')] },
  ];
  const token = await mintCommitToken('trip-x', days);
  const { sb, captured } = makeFakeSb(days);
  await persistTripItinerary(sb as any, 'trip-x', { days }, {
    label: 'test',
    extraUpdate: { itinerary_status: 'ready' },
    commitToken: token,
  });
  const audit = captured.updatePayload?.metadata?.quality?.commit_token_audit;
  assert(audit, 'expected audit');
  assertEquals(audit.result, 'verified');
});

Deno.test('persist: strict mode demotes ready→partial when token missing', async () => {
  Deno.env.set('COMMIT_TOKEN_STRICT', 'true');
  try {
    const days = [
      { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3')] },
    ];
    const { sb, captured } = makeFakeSb(days);
    await persistTripItinerary(sb as any, 'trip-x', { days }, {
      label: 'test',
      extraUpdate: {
        itinerary_status: 'ready',
        metadata: { itinerary_frozen_at: '2026-05-30T00:00:00Z', fully_persisted: true },
      },
    });
    assertEquals(captured.updatePayload.itinerary_status, 'partial');
    // freeze stamps stripped
    assertEquals(captured.updatePayload.metadata.itinerary_frozen_at, undefined);
    assertEquals(captured.updatePayload.metadata.fully_persisted, undefined);
    const audit = captured.updatePayload.metadata.quality?.commit_token_audit;
    assertEquals(audit.result, 'missing');
    assertEquals(audit.strict, true);
    assertEquals(audit.enforced, true);
  } finally {
    Deno.env.delete('COMMIT_TOKEN_STRICT');
  }
});

Deno.test('persist: strict mode allows ready when valid token forwarded', async () => {
  Deno.env.set('COMMIT_TOKEN_STRICT', 'true');
  try {
    const days = [
      { dayNumber: 1, activities: [act('A1'), act('A2'), act('A3')] },
    ];
    const token = await mintCommitToken('trip-x', days);
    const { sb, captured } = makeFakeSb(days);
    await persistTripItinerary(sb as any, 'trip-x', { days }, {
      label: 'test',
      extraUpdate: { itinerary_status: 'ready' },
      commitToken: token,
    });
    // Re-gate may still demote on integrity grounds, but token verified
    // means strict-mode did NOT pre-demote. Audit confirms verified.
    const audit = captured.updatePayload.metadata.quality?.commit_token_audit;
    assertEquals(audit.result, 'verified');
    assertEquals(audit.enforced, undefined);
  } finally {
    Deno.env.delete('COMMIT_TOKEN_STRICT');
  }
});
