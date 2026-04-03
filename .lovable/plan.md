
Fix the meal-guard reporting so it stops showing contradictory states like “breakfast, lunch, dinner” and “guard fired (+lunch)” on the same row.

What’s happening
- In `supabase/functions/generate-itinerary/action-generate-day.ts`, the admin diagnostics are built after the meal guard runs.
- That means the “found meals” list already includes the injected meal.
- It also uses a different heuristic than `detectMealSlots(...)`, which is why raw `dining` can appear beside real meal slots.

Plan
1. Make diagnostics use the same detector as the guard
- Replace the local `foundMeals` logic in `action-generate-day.ts` with `detectMealSlots(...)` from `day-validation.ts`.
- This makes the logs and the guard share one source of truth.

2. Capture meals both before and after the guard
- Record `beforeGuard` just before `enforceRequiredMealsFinalGuard(...)`.
- Record `afterGuard` after the guard finishes.
- Keep `guardFired` and `injected` alongside them.

3. Stop showing `dining` as if it were a meal slot
- Remove the current fallback that pushes category names like `dining` into the meal list.
- If needed, track generic dining cards separately as a count/flag instead of mixing them with breakfast/lunch/dinner.

4. Update the admin log UI
- In `src/pages/admin/GenerationLogs.tsx`, render meal info as:
  - Final: breakfast, lunch, dinner
  - Guard injected: lunch
  - Before guard: breakfast, dinner
- This makes it obvious whether lunch existed originally or was added by the repair step.

5. Update supporting types
- Adjust the meal diagnostics shape in `supabase/functions/generate-itinerary/generation-timer.ts` and the frontend `GenerationLog` type so the new fields are typed consistently.

6. Add a regression test
- Add a focused test for the “missing lunch gets injected” case.
- Verify the diagnostics report:
  - `beforeGuard = [breakfast, dinner]`
  - `afterGuard = [breakfast, lunch, dinner]`
  - `injected = [lunch]`
  - no raw `dining` in the displayed meal slots

Expected result
- The guard can still inject missing meals when needed.
- But the logs will no longer look self-contradictory, and we’ll be able to tell the difference between a real guard fire and a reporting artifact.
