## Problem

`action-generate-day.ts` (single-day refresh) caches `metadata.quality.meal_policy_at_generation` at line 336. The multi-day generator in `action-generate-trip-day.ts` derives the same policy but never persists it. Health panel reads from this metadata key — so day-refreshed trips report meal violations correctly, but multi-day-generated trips silently pass.

## Fix

Mirror the `action-generate-day.ts:336-346` write in two places inside `supabase/functions/generate-itinerary/action-generate-trip-day.ts`.

### Site A — final per-day guard (~after line 1803)

Right after the `if/else` meal_audit block that closes at line 1803, insert (unconditional, sibling of the audit assignment):

```ts
dayResult.metadata = dayResult.metadata || {};
dayResult.metadata.quality = dayResult.metadata.quality || {};
dayResult.metadata.quality.meal_policy_at_generation = {
  dayMode: _fmgPolicy.dayMode,
  requiredMeals: _fmgPolicy.requiredMeals,
  isFullExplorationDay: _fmgPolicy.isFullExplorationDay,
  arrivalTime24: _isFirstDay ? (savedArrTime24Hoisted ?? null) : null,
  departureTime24: _isLastDay ? (savedDepTime24Hoisted ?? null) : null,
  generated_at: new Date().toISOString(),
};
```

Written unconditionally (not gated on `!alreadyCompliant`) to match `action-generate-day.ts` behavior — the cache must exist even when generation produced a compliant day.

### Site B — multi-day finalization loop (~line 2335, right after `policy` is derived)

In the loop at lines 2322-2371, immediately after `deriveMealPolicy(...)` returns `policy` and **before** the `if (policy.requiredMeals.length === 0) { … continue; }` early-return, insert:

```ts
updatedDays[i].metadata = updatedDays[i].metadata || {};
updatedDays[i].metadata.quality = updatedDays[i].metadata.quality || {};
updatedDays[i].metadata.quality.meal_policy_at_generation = {
  dayMode: policy.dayMode,
  requiredMeals: policy.requiredMeals,
  isFullExplorationDay: policy.isFullExplorationDay,
  arrivalTime24: isFirstDayLoop ? (savedArrivalTime24 ?? null) : null,
  departureTime24: isLastDayLoop ? (savedDepartureTime24 ?? null) : null,
  generated_at: new Date().toISOString(),
};
```

Placed before the `requiredMeals.length === 0` early-continue so even pure-exploration days carry the cache (health engine needs to know "policy was applied, no meals required" vs. "never recorded").

## Verification

1. `rg -n "meal_policy_at_generation" supabase/functions/generate-itinerary/` → 3 write sites (was 1).
2. Generate a fresh multi-day trip; confirm `itinerary_data.days[i].metadata.quality.meal_policy_at_generation` is populated for every day, including days where `requiredMeals` is empty.
3. Confirm health panel now flags meal violations on multi-day-generated trips that previously passed silently.

## Out of scope

No changes to `action-generate-day.ts`, no changes to the health engine, no schema/migration changes.