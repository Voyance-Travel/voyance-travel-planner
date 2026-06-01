# Plan: don't classify "incomplete" while placeholder days exist

## Root cause (confirmed against code)

When a day times out mid-generation, `generation-core.ts` lines 3036–3050 pad `daysArray` with `{ activities: [], status: 'placeholder' }` so the UI still shows all expected days. Stage 6's empty/incomplete gate at line 3098 then runs `classifyItineraryCompleteness` on that padded array. `meaningfulCount` for a 3-real + 1-placeholder 4-day trip is 9–15 across real days but the threshold is `Math.max(2, 4) = 4` — wait, that passes. But when a partial-content day is the one that timed out and a placeholder takes its slot, the meaningful total can fall below the floor, and the placeholder day clearly contributes 0. Either way, **completeness must not be judged while a `status:'placeholder'` day is still in the array** — generation is by definition not done.

The save-itinerary gate (`action-save-itinerary.ts` line 1504) re-runs the exact same classifier on `itinerary.days`. If a retry-success path persists a `days` array that still carries a placeholder marker, the stamp gets re-applied and the clear branch at line 1736 never runs.

## The fix (surgical, two sites, mirror logic)

**Bug A — `supabase/functions/generate-itinerary/generation-core.ts` around line 3097**

Wrap the existing `try { … classifyItineraryCompleteness(daysArray) … }` block in a guard:

```ts
const hasPlaceholderDay = (daysArray as any[]).some(
  (d: any) => d?.status === 'placeholder'
);
if (hasPlaceholderDay) {
  console.warn(
    `[Stage 6] Skipping empty/incomplete probe — ${
      (daysArray as any[]).filter((d: any) => d?.status === 'placeholder').length
    } placeholder day(s) still present; generation incomplete, classifier would mis-stamp.`
  );
} else {
  // existing classifier block: probe → emptyItineraryDetected / failureReason
}
```

`emptyItineraryDetected` stays `false` in the placeholder case → the downstream `extraUpdate` (line 1734-style block in this file too) takes the `null` clear branch and the trip is not flagged. When the retry chain later persists a fully-populated `daysArray` via `action-save-itinerary`, the proper classifier pass runs against real data.

**Bug B — `supabase/functions/generate-itinerary/action-save-itinerary.ts` around line 1500**

Same guard, same reason. If the caller passes a `days` array that still has a placeholder slot (mid-chain save, in-flight retry, optimistic write), the save gate must not stamp `incomplete_itinerary`. It already takes the clear branch when `emptyItineraryDetected === false` (line 1736), so the one-line skip is enough:

```ts
const hasPlaceholderDay = ((itinerary as any)?.days || []).some(
  (d: any) => d?.status === 'placeholder'
);
let emptyItineraryDetected = false;
let failureReason: 'empty_itinerary' | 'incomplete_itinerary' | null = null;
if (!hasPlaceholderDay) {
  // existing try { classifyItineraryCompleteness … } block
}
```

This automatically resolves the "stamp sticks after retry" symptom: the next save that lands without placeholders runs the classifier on real data, sees `ok`, and the line 1736 clear branch fires.

## What is NOT changing

- `itineraryCompleteness.ts` frontend mirror — frontend never sees placeholder rows in a persisted-and-ready trip; the parser/ghost filter already strips empty-shell rows. No code change needed there. (If a regression appears we'll add the same skip; deferring.)
- `day-validation.ts` `classifyItineraryCompleteness` — the function itself is correct. The bug is calling it at the wrong moment, not the function's logic.
- The 2026-06-01 dynamic threshold (`< Math.max(2, dayCount)`) — stays as-is.
- No backfill. The mis-stamped trips were already healed by the 2026-06-01 v2 backfill migration; once the two skips above ship, no new mis-stamps can occur.

## Files touched

1. `supabase/functions/generate-itinerary/generation-core.ts` — wrap line ~3097 classifier block in `hasPlaceholderDay` guard.
2. `supabase/functions/generate-itinerary/action-save-itinerary.ts` — wrap line ~1503 classifier block in `hasPlaceholderDay` guard.

Two edits. Each ~5 lines. No migration. No DB change. No frontend change.

## Out of scope (separate root causes)

- Anne Frank House drop (needs its own POI-inclusion trace).
- "Walk to airport" departure transit (departure-side transit mode logic).
