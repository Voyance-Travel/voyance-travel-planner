

## Fix Budget Coach: Disappearing Suggestions + Wrong Activity Name

### Bug 1: Suggestions disappear when applying swaps

**Root cause:** Line 347 in `BudgetCoach.tsx`:
```
if (isNowOnTarget && !isApplied) return null;
```
As soon as accumulated applied savings exceed the budget gap, all remaining unapplied suggestions are hidden instantly. This is jarring — the user loses their context mid-decision.

**Fix:** Instead of hiding unapplied suggestions when on-target, keep all suggestions visible but visually de-emphasize the remaining ones (muted styling, disabled Apply button). The user can still browse and optionally apply more swaps. Remove the early `return null`.

### Bug 2: Reason text overwrites the activity description

**Root cause:** In `EditorialItinerary.tsx` line 4787-4789, when a swap is applied:
```ts
title: suggestion.suggested_swap,    // e.g. "Picnic from Lenwich"
name: suggestion.suggested_swap,
description: suggestion.reason,       // e.g. "A picnic is cheaper than a sit-down restaurant"
```
The `reason` field (an explanation of *why* the swap saves money) is being written as the activity `description`. So the itinerary card shows the budget reasoning instead of a proper activity description.

**Fix:** Update the edge function's tool schema to include a new `suggested_description` field — a short, experience-focused description of the replacement activity (e.g., "Grab gourmet sandwiches from Lenwich and enjoy a picnic in Central Park"). On the frontend, use `suggested_description` for the activity description and keep `reason` only for display inside the Budget Coach panel.

### Changes

| File | Change |
|------|--------|
| `src/components/planner/budget/BudgetCoach.tsx` | Remove the `isNowOnTarget && !isApplied → return null` filter; instead show remaining suggestions with muted/disabled styling |
| `supabase/functions/budget-coach/index.ts` | Add `suggested_description` to the tool schema and prompt instructions; this should be an activity-style description of the replacement |
| `src/components/itinerary/EditorialItinerary.tsx` | Use `suggestion.suggested_description` (falling back to `suggestion.suggested_swap`) for the activity description instead of `suggestion.reason` |
| `src/components/planner/budget/BudgetCoach.tsx` | Update `BudgetSuggestion` type to include optional `suggested_description` field |

