## Problem

Day 2 of a 3-day Venice trip ends with the "Kinetic Lagoon Private Boat Adventure" (15:50–17:20) followed by "Return to JW Marriott via Shuttle Boat" — and **nothing else**. No dinner, no nightcap, no evening activity. For a luxury 3-day trip with no logistics constraints on day 2, this is a hard violation of the Meal Rules core ("3 meals/full day", "Exactly One Dinner (18:00+)").

## Root cause — multiple compounding failures

There ARE three meal-guard call sites that should each have caught this independently:

1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts:1967` — multi-day finalization loop
2. `supabase/functions/generate-itinerary/action-generate-day.ts:1509` — single-day refresh path
3. `supabase/functions/generate-itinerary/action-save-itinerary.ts:332` — last-resort save guard

Despite three layers, dinner still didn't reach the user. Audit findings:

### Bug A — `universalQualityPass` injects "Return to Hotel" BEFORE the meal guard runs

`universal-quality-pass.ts:255` (Step 8) injects "Return to {hotel}" immediately after the boat tour ends at 17:20, because the rule fires whenever the last activity ends in 17:00–23:59. This pass runs at `action-generate-trip-day.ts:1517`. The meal-guard runs much later at line 1967.

When dinner is finally injected at 19:00 by the meal-guard, the activities are sorted by start time, producing the order: `Boat 15:50` → `Return to Hotel 17:20` → `Dinner 19:00`. The "Return to Hotel" card carries strong semantic finality in the UI, so even if dinner ships, the day reads as "ends at 5:20 PM" — and if the dinner injection ever fails (Bug B/C below), the user sees exactly the bug reported.

### Bug B — save-time meal-guard fallback query uses wrong column

`action-save-itinerary.ts:322` queries `verified_venues` with `.ilike('city', ...)` — but the column is named `destination` (confirmed against the live schema). The query throws and is silently swallowed by the surrounding `try/catch`, leaving `saveFallbackVenues = []`. The guard still injects via the emergency-fallback DB, but with no curated city-specific options. For Venice with a thin emergency pool, this means the safety net is materially weaker than intended.

### Bug C — no observability on meal-guard outcomes per day

There is no structured log line that captures "Day N: requiredMeals=[…], detected=[…], missing=[…], injected=[…]" in a greppable format, and no `metadata.quality.missing_meals` field on the day. So when this regression happens we cannot tell which guard ran, what it saw, or why dinner didn't survive.

### Bug D — meal-guard runs against pre-finalized activities

The meal-guard at `action-generate-trip-day.ts:1967` runs in the multi-day finalization loop. It runs AFTER `universalQualityPass` (which already injected "Return to Hotel"). But the meal-guard is the last meaningful pass — there is no follow-up that re-checks whether dinner survived later mutations (e.g., the recently-added second-pass dead-gap fill we just shipped, the cross-day dedup, transport-collapse safety net).

## Fix — four targeted changes

### Layer 1 — Defer "Return to Hotel" when dinner is required but missing

In `supabase/functions/generate-itinerary/universal-quality-pass.ts` Step 8 (lines ~254–305), before injecting the hotel-return card:

```text
if (dayIndex < totalDays - 1 && result.length > 0) {
  // NEW: skip hotel-return injection if this is a full-exploration day
  // and no dinner is present yet. Let the meal-guard inject dinner first;
  // a later save-time pass will add the hotel-return after dinner.
  if (dinnerIsRequiredAndMissing(result, dayContext)) {
     return result;  // skip Step 8 — meal-guard will fill dinner and a
                     // subsequent terminal pass will append hotel-return.
  }
  ...existing logic...
}
```

`dinnerIsRequiredAndMissing` calls `deriveMealPolicy` (or accepts the policy from the caller) and `detectMealSlots`; returns `true` only when the day requires dinner and none is present. Caller (`action-generate-trip-day.ts:1517`) already has `policy` available — pass it through `universalQualityPass` options.

This turns the order into: `Boat 15:50 → Dinner 19:00 → Return to Hotel 20:30`. The day no longer reads as "ends at 5:20 PM" even before any guard fires.

### Layer 2 — Fix `verified_venues` column name in save-time guard

In `action-save-itinerary.ts:322`:

```ts
.ilike('city', `%${destination.split(',')[0].trim()}%`)
// →
.ilike('destination', `%${destination.split(',')[0].trim()}%`)
```

Restores the curated venue pool for the last-resort save-time meal-guard, so when generation fails to inject dinner the save guard has real Venice (or any-city) options instead of the global emergency pool.

### Layer 3 — Add a final post-everything meal-guard pass

In `action-generate-trip-day.ts`, immediately after the second-pass dead-gap fill (which we added in the previous turn at ~line 1558), add a final meal-guard pass that re-runs `enforceRequiredMealsFinalGuard` for the just-finalized day. This catches any meal that fell out of the day during cross-day dedup, universalQualityPass mutations, transport collapse, or the second-pass gap fill — i.e. it closes the same class of "downstream pass eats a meal" leak that the dead-gap second pass closes for unplanned windows.

The existing meal-guard at line 1967 stays, but a per-day re-check at the end of the per-day pipeline gives us belt-and-braces coverage AND catches the case where a day is saved without going through the multi-day finalization loop (e.g., chain mode partial returns).

### Layer 4 — Observability

In all three meal-guard call sites, emit a single greppable structured log per day:

```
[MEAL_AUDIT] day=2 dest="Venice" mode=full_exploration required=[breakfast,lunch,dinner] detected=[breakfast,lunch] missing=[dinner] injected=[dinner] source="generate-trip-day"
```

And persist on the day:

```ts
day.metadata = day.metadata || {};
day.metadata.quality = day.metadata.quality || {};
day.metadata.quality.meal_audit = {
  required, detected_pre, missing_pre, injected, detected_post,
  injected_at_hh_mm, source,
};
```

No UI change required — this is purely diagnostic so the next regression is greppable in one query and analytics can track frequency.

### Tests

- `meal-policy.test.ts` — extend with a Venice day-2 fixture: boat tour ending 17:20, no dinner. Run end-to-end pipeline harness; assert dinner is injected AND scheduled at 18:00–22:00 AND the "Return to Hotel" card (if any) is AFTER the dinner.
- `universal-quality-pass.test.ts` — assert Step 8 skips hotel-return injection when `dinnerIsRequiredAndMissing` returns true; asserts it still injects when dinner is present.
- `action-save-itinerary.fallback.test.ts` (new) — mock the `verified_venues` query, assert it's called with `destination` and not `city`.

### Memory

Update `mem://constraints/itinerary/believable-human-pacing-principle` (or create a new memory `mem://constraints/itinerary/dinner-required-defer-hotel-return`) with:

> **Hotel-return defers to dinner.** `universalQualityPass` Step 8 must NOT inject "Return to Hotel" when the day requires dinner and dinner is not yet present — the meal-guard runs later and the hotel-return card carries semantic finality that masks the missing dinner. Order MUST be `last activity → dinner → return to hotel`. Save-time meal-guard queries `verified_venues` by `destination` (not `city`).

## Files

- **Edit** `supabase/functions/generate-itinerary/universal-quality-pass.ts` — Step 8 dinner-required guard; thread `mealPolicy` through options.
- **Edit** `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — pass policy into universalQualityPass options; add final per-day meal-guard pass right after second-pass dead-gap fill; emit `[MEAL_AUDIT]` log.
- **Edit** `supabase/functions/generate-itinerary/action-generate-day.ts` — pass policy into universalQualityPass options; emit `[MEAL_AUDIT]` log.
- **Edit** `supabase/functions/generate-itinerary/action-save-itinerary.ts` — fix column name `city` → `destination`; emit `[MEAL_AUDIT]` log; persist `metadata.quality.meal_audit`.
- **New tests** in `meal-policy.test.ts`, `universal-quality-pass.test.ts`, `action-save-itinerary.fallback.test.ts`.
- **Memory** — new `mem://constraints/itinerary/dinner-required-defer-hotel-return` referenced from `mem://index.md` Memories.

No DB schema changes. No UI changes.
