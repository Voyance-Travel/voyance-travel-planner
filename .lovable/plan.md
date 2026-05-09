# Close Bug #1 — Orphaned Transit Connectors

## Root cause
`pruneOrphanTransits` runs inside `universalQualityPass` but the meal-guard (`enforceRequiredMealsFinalGuard` in `day-validation.ts`) splices activities **after** that pass, leaving "Travel to Salsify at The Roundhouse" dangling when the duplicate "Dinner at Salsify" is removed. No downstream step catches it.

## Fix A — Sweep at the drop site (`day-validation.ts`)
Add `import { pruneOrphanTransits } from '../_shared/orphan-transit.ts';` and call it immediately after each in-place splice block in `enforceRequiredMealsFinalGuard`:

1. After the placeholder-meal strip (~line 891), inside the `if (before !== activities.length)` block.
2. After the duplicate-meal strip loop (~line 1019).

## Fix B — Final pre-save safety net (`action-generate-trip-day.ts`)
Insert a single idempotent `pruneOrphanTransits(dayResult.activities)` call between the duplicate-hotel-return removal (~line 1875) and the stage logger flush (~line 1880), with a `console.warn` mirroring the existing `[ORPHAN-TRANSIT]` log shape. Use a static top-of-file import rather than dynamic `await import()` to stay consistent with the file's import style.

## Out of scope
- No changes to `pruneOrphanTransits` itself (token-match already handles "Travel to Salsify at The Roundhouse").
- No LLM prompt changes — this is a deterministic post-processor bug.
- No `applyValidationGate` wiring (it can't restore meals; wouldn't help).

## Test
Extend `supabase/functions/generate-itinerary/meal-policy.test.ts` with one Deno regression case (using `assertEquals` from std, matching repo style) covering: two `Dinner at Salsify`/`Dinner at La Colombe` cards plus a preceding `Travel to Salsify at The Roundhouse`, asserting the invariant — transit survives iff its target survives.

## Verification
1. `deno test --allow-all generate-itinerary/meal-policy.test.ts` passes.
2. `npm run typecheck` clean.
3. Deploy `generate-itinerary`; grep logs for `[ORPHAN-TRANSIT] Dropped` after `[MEAL FINAL GUARD] ... Removing duplicate meal`.

## Files
- `supabase/functions/generate-itinerary/day-validation.ts` (import + 2 calls)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (1 call + import)
- `supabase/functions/generate-itinerary/meal-policy.test.ts` (1 new test)
