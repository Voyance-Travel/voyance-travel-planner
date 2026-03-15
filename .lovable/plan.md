
Fix the meal-planning bug by making meal requirements depend on actual day shape, not a blanket “3 meals unless first/last day” rule.

What’s going wrong now
- In `supabase/functions/generate-itinerary/index.ts`, a day is treated as “full” with `!isFirstDay && !isLastDay`, so many mid-trip half days are wrongly forced into breakfast + lunch + dinner.
- That creates conflicts with existing constraint logic that already says some days should be lighter:
  - `full_day_event` says “do NOT add other activities, meals, or experiences”
  - arrival/departure prompts in `prompt-library.ts` already imply fewer meals
  - transition/travel days are not true full exploration days
- In `personalization-enforcer.ts`, `requiredMealSlots` are derived from pace only, not from day type/window, so validation still pressures half days to carry extra meals.

Plan
1. Add one shared “day meal policy” decision layer
- Create a central helper that classifies each day as one of:
  - full exploration day
  - arrival day
  - departure day
  - transition/travel day
  - full-day event day
  - constrained/half day (large locked time block or limited usable hours)
- From that, derive required meals:
  - Full day: breakfast + lunch + dinner
  - Late arrival: optional dinner only
  - Midday arrival / short half day: lunch + dinner or just dinner depending usable hours
  - Morning departure: breakfast only
  - Afternoon departure: breakfast + lunch
  - Full-day event: no default meal pressure, only event-adjacent meal if time allows
  - Transition day: meal count based on remaining free window, not automatic 3

2. Replace hardcoded full-day meal language in generation prompts
- Update `supabase/functions/generate-itinerary/index.ts`
- Remove the simplistic `isFullDay = !isFirstDay && !isLastDay` meal behavior
- Replace prompt text like:
  - “3 meals per full day — NO EXCEPTIONS”
  - “DAY TYPE: Full exploration day...with 3 meals”
  - “FULL DAY: breakfast + ... + lunch + dinner”
- Instead inject dynamic wording from the shared day meal policy for that exact day

3. Align `prompt-library.ts` with the same source of truth
- Keep its good arrival/departure nuance, but stop duplicating meal assumptions separately
- Use the same meal-policy helper so first day, last day, and normal days all follow one consistent rule set

4. Fix validation so half days stop failing or being nudged toward extra meals
- Update `supabase/functions/generate-itinerary/personalization-enforcer.ts`
- Change `requiredMealSlots` to accept day context, not just pace
- Validation should only require meals that belong to that day’s derived policy
- Keep brunch matching logic, but only against meals expected for that day

5. Respect existing special-day constraints
- Ensure the shared policy explicitly honors:
  - `full_day_event`
  - locked/time-block days
  - transition days
  - flight arrival/departure timing
- This removes prompt contradictions where one block says “no other meals” and another block still demands 3 meals

6. Add debugging output
- Log derived day type + required meals for each generated day
- This will make it easy to inspect why a day got 1, 2, or 3 meals

Files to update
- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/generate-itinerary/prompt-library.ts`
- `supabase/functions/generate-itinerary/personalization-enforcer.ts`

Technical notes
- I would centralize this as a helper returning:
  - `dayMode`
  - `requiredMeals`
  - `mealInstructionText`
  - `isFullExplorationDay`
- Inputs should include:
  - first/last day
  - arrival/departure window
  - transition-day flag
  - locked/pre-booked windows
  - full-day-event constraints
  - available usable hours
- This keeps generation, validation, and future rewrite/regenerate flows in sync.

Expected result
- Normal full days still get 3 meals
- Half days stop being overstuffed
- Event/travel days stop fighting the prompt
- Meal variety stays enforced, but only for meals that should actually exist on that day

Validation scenarios after implementation
- Late arrival day → dinner only
- Midday arrival day → lunch + dinner max
- Morning departure → breakfast only
- Afternoon departure → breakfast + lunch
- Mid-trip full-day event → no forced 3-meal structure
- Transition day → no forced full-day meal stack
- Standard middle day → still breakfast + lunch + dinner
