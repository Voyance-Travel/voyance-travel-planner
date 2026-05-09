# Plan: Test coverage for items 1–6

## What's already covered

Most of the verification list is already test-backed from the prior items:

- **Orphan transit "Transfer to Airport survives" + "Walk to Salsify dropped"** — `supabase/functions/_shared/__tests__/orphan-transit.test.ts` (5 cases including the metadata-based departure exemption).
- **Description sanitization for `Reservation Urgency: .`** — `src/utils/__tests__/activityNameSanitizer.artifacts.test.ts` lines 32–45 (orphan label, value-bearing segment, legit-Reservation preservation).
- **Item 4 (`SUSPICIOUS_DUPLICATE_PRICE`)** — we picked path-metadata-only (autoRepairable flag flip); existing `pipeline/__tests__/duplicate-price.test.ts` covers runtime behavior.
- **Item 6 (final validation gate)** — gate logic itself is covered by `validation-gate.test.ts`; the new wiring is a second invocation of an already-tested function. No new unit test adds signal here — what matters is the integration sentinel `[FINAL_GATE]` in edge logs (verification step #7 in the user's checklist).

## What's missing

### 1. `enforceRequiredMealsFinalGuard` — orphan transit cleared after duplicate-meal strip

The duplicate-meal dedup branch at `day-validation.ts:1022–1027` calls `pruneOrphanTransits` after removing the second dinner. No test currently asserts the transit pointing at the dropped dinner is also removed.

**Add** to `supabase/functions/generate-itinerary/meal-policy.test.ts`:

```ts
Deno.test('enforceRequiredMealsFinalGuard: prunes orphan transit after duplicate-meal dedup', () => {
  const day = buildDay([
    'Breakfast at Truth Coffee',         // 08:00 dining
    'Tour Kirstenbosch',                  // 10:00 activity
    'Lunch at Test Kitchen',              // 12:00 dining
    'Walk to Salsify at The Roundhouse',  // 14:00 transit pointing at the dup dinner
    'Dinner at Salsify',                  // 16:00 dining (first dinner)
    'Dinner at Salsify',                  // 18:00 dining (duplicate to be removed)
  ], 2);
  // Mark the transit explicitly so the guard's transit-detection treats it as such
  day.activities[3].category = 'transport';
  day.activities[3].transportation = { method: 'walk', duration: '10 min', estimatedCost: { amount: 0, currency: 'USD' }, instructions: '' };

  const result = enforceRequiredMealsFinalGuard(
    day.activities,
    ['breakfast', 'lunch', 'dinner'],
    2,
    'Cape Town',
    'USD',
    'unknown',
    [],
  );

  // Duplicate dinner removed
  const dinnerCount = result.activities.filter((a: any) => /dinner/i.test(a.title)).length;
  assertEquals(dinnerCount, 1);

  // Orphan transit pointing at the removed dinner also cleared
  const transitToSalsify = result.activities.find((a: any) => /walk to salsify/i.test(a.title));
  assertEquals(transitToSalsify, undefined);
});
```

Imports already in scope (`enforceRequiredMealsFinalGuard`, `buildDay`, `assertEquals`).

### 2. Orphan-transit explicit "Travel to" prefix case

The user's verification wording calls out "Travel to Salsify" specifically. Existing tests use "Walk to" / "Taxi to". Add one case to `supabase/functions/_shared/__tests__/orphan-transit.test.ts` so the name in the bug report maps directly to a green test:

```ts
Deno.test('end-of-day "Travel to <restaurant>" dropped (no logistics keyword, generic verb)', () => {
  const acts = [
    { id: '1', title: 'Tour Kirstenbosch', category: 'sightseeing' },
    { id: '2', title: 'Travel to Salsify at The Roundhouse', category: 'transport' },
  ];
  const removed = pruneOrphanTransits(acts);
  assertEquals(removed, 1);
  assertEquals(acts.length, 1);
});
```

## Out of scope

- No new validation-gate or final-gate unit tests — function under test is unchanged; only an additional invocation site was added. Integration assertion lives in edge logs (`[FINAL_GATE]` sentinel).
- No React-render component tests for the description wrappers — the unit-level sanitizer test is faster, deterministic, and already passing. Rendering `ActiveTrip`/`DestinationDetail` would require mocking trip queries, auth, and supabase client — a lot of glue for redundant signal.

## Verification

- Run `supabase--test_edge_functions` filtered to `meal-policy` and `_shared` (orphan-transit) — both new cases green, all existing cases still green.
- Frontend artifacts test stays unchanged and green (`vitest run src/utils/__tests__/activityNameSanitizer.artifacts.test.ts`).
