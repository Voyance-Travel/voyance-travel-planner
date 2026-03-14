## Fix: Budget Coach — disabled buttons, stale suggestions, and UUID errors

### Three issues identified

**1. Buttons disabled before reaching target (**`isDeemphasized`**)** 

- Line 419: `disabled={isApplied || isDeemphasized}`
- `isDeemphasized = isNowOnTarget && !isApplied` (line 348)
- Before applied savings exceed the gap, ALL remaining suggestions become disabled
- **Fix**: Remove the `isDeemphasized` disable. Keep the visual de-emphasis (opacity) but let users keep applying swaps if they want to cut further. Change `disabled={isApplied || isDeemphasized}` → `disabled={isApplied}`.

**2. Applied suggestions not removed from list**

- After applying a swap and returning to the budget tab, the same suggestions appear because they're cached in `suggestionsCache` (line 74) and the `appliedIds` state resets on remount.
- **Fix**: In `handleApply`, after applying a suggestion, remove it from the `suggestions` state and update the cache. This way applied swaps disappear from the list immediately and won't reappear on re-visit.

**3. `activity_id` is not a UUID — 400 error on `activity_costs` upsert**

- Error: `invalid input syntax for type uuid: "breakfast-w-rome"`
- The AI-generated itinerary uses slug-style IDs (e.g., `breakfast-w-rome`, `lunch-ba-ghetto`) which are not valid UUIDs.
- `activity_costs.activity_id` is a UUID column, so the upsert fails.
- **Fix**: In `onApplyBudgetSwap` (EditorialItinerary.tsx line 5259), before calling `upsertActivityCost`, check if `suggestion.activity_id` is a valid UUID. If not, skip the upsert (the itinerary data update on line 5206 already applies the swap correctly — the cost table write is a nice-to-have sync, not required for the swap to work). Log a warning instead of crashing.

### Files to edit

`**src/components/planner/budget/BudgetCoach.tsx**`

- Line 348: Keep `isDeemphasized` for styling only
- Line 419: Change to `disabled={isApplied}`
- Line 252-259 (`handleApply`): After applying, remove the suggestion from `suggestions` state and update the cache

`**src/components/itinerary/EditorialItinerary.tsx**`

- Lines 5257-5270: Guard the `upsertActivityCost` call with a UUID format check on `suggestion.activity_id`. Skip gracefully if not a valid UUID.