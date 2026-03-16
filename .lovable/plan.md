The issue is not that meal logic is missing. It is that there are too many overlapping meal systems, and they are not actually wired together consistently.

&nbsp;

We have said this and "fixed" this before. we need to stop it from being a consitent issue. 

What’s going wrong:

- `meal-policy.ts` correctly derives which meals a day should require.
- `index.ts` injects meal requirements into the prompt.
- `day-validation.ts` separately enforces a simpler rule: only non-first/non-last days must have breakfast/lunch/dinner.
- `personalization-enforcer.ts` supports `requiredMealsOverride`, but the generation path does not appear to pass the derived meal policy into it.
- The “fallback meal injection” in `index.ts` only runs on the final retry, only for non-first/non-last days, and uses hardcoded B/L/D slots instead of the derived day policy.

So the root cause is architectural drift:

```text
derived meal policy exists
→ prompt uses it
→ validators partly ignore it
→ fallback ignores it
→ generation can still ship a day with missing meals
```

Why this keeps happening:

- Meals are enforced in multiple places with different rules.
- The final guard is too narrow and not policy-driven.
- A day can pass through because one layer thinks it is constrained while another still expects full meals.
- There is no single “before save” guarantee that the final itinerary matches the required meal policy for that day.

Implementation plan:

1. Make `deriveMealPolicy(...)` the only source of truth for meal requirements.
  - Use it for prompt construction, validation, retry decisions, and fallback injection.
  - Remove hardcoded “non-first/non-last means 3 meals” assumptions where possible.
2. Update `day-validation.ts` to validate against an explicit required meal list instead of inferring from day position alone.
  - Pass the required meals for the day into validation.
  - Treat missing required meals as hard errors for any day where the policy requires them.
3. Wire the same required meals into `validateDayPersonalization(...)`.
  - Actually pass `requiredMealsOverride` from generation.
  - This keeps schedule/personalization validation aligned with the meal policy.
4. Replace the current fallback injector with a policy-aware finalization step.
  - If a day is missing required meals after all retries, inject only the meals required by that day’s policy.
  - Respect arrival/departure/transition/constrained-day logic.
  - Re-sort and then run one final validation pass before saving.
5. Add strong logging around meal enforcement.
  - For each generated day, log:
    - derived day mode
    - required meals
    - meals found before validation
    - meals injected in fallback
  - This will make future regressions obvious instead of mysterious.
6. Add targeted regression coverage.
  - Full exploration day → must end with breakfast, lunch, dinner.
  - Morning arrival / midday arrival / departure / constrained day → only policy-required meals.
  - Final fallback path → still produces required meals even when AI misses them.

Files to update:

- `supabase/functions/generate-itinerary/meal-policy.ts`
- `supabase/functions/generate-itinerary/day-validation.ts`
- `supabase/functions/generate-itinerary/personalization-enforcer.ts`
- `supabase/functions/generate-itinerary/index.ts`
- likely `supabase/functions/generate-itinerary/index.test.ts`

Expected result:

- Every day will either:
  - include the exact meals required for that day type, or
  - be auto-corrected before save.
- No more “we asked for this five times” because the final saved itinerary will be checked against one shared rule system.

Technical note:
The biggest bug is not the AI. It is that the engine has a valid meal policy module, but downstream validation/fallback still uses older parallel rules. The permanent fix is to centralize meal enforcement and make the final saved output policy-validated, not just prompt-guided.

Verify that it worksAdd Meal DiagnosticsAdd Meal Regression Tests