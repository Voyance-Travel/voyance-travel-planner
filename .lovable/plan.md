## RS.M.I3 — Cache generation-time meal policy on the day, prefer it on save

### Context

Meal policy is currently derived twice:

1. **At generation** — `pipeline/compile-prompt.ts` calls `deriveMealPolicy(...)` (3 sites: arrival/departure/middle day, lines 647 / 661 / 705) using `flightContext.arrivalTime24` / `flightContext.returnDepartureTime24`. The result `dayMealPolicy` is returned from `compilePrompt` and consumed by `action-generate-day.ts` (already in scope at line 214).
2. **At save** — `action-save-itinerary.ts` line 297 re-derives policy using `savedArrivalTime24` / `savedDepartureTime24` read fresh from `trips`.

If flight times change between generation and save (user edits, hotel auto-arrival recompute, multi-traveler merge), the two policies silently diverge — meal-guard at save time can inject the wrong required meals or skip them.

The user's spec mentions `compile-day-facts.ts` but the policy is actually computed in `compile-prompt.ts` and the day object is assembled later (after the AI call) in `action-generate-day.ts`. The natural stamp site is `action-generate-day.ts`, where both `dayMealPolicy` and `generatedDay` exist together.

### Changes

**1. `supabase/functions/generate-itinerary/action-generate-day.ts`** — stamp the policy onto the generated day

Right after `generatedDay` is fully built and before post-processing branches that mutate it (around line ~330, after the `else { generatedDay = buildPlaceholderDay(...) }` block from RS.M.I2), add:

```ts
// RS.M.I3: cache the meal policy used during generation so action-save-itinerary
// can prefer it instead of re-deriving from possibly-changed flight times.
if (dayMealPolicy) {
  generatedDay.metadata = generatedDay.metadata || {};
  generatedDay.metadata.quality = generatedDay.metadata.quality || {};
  generatedDay.metadata.quality.meal_policy_at_generation = {
    dayMode: dayMealPolicy.dayMode,
    requiredMeals: dayMealPolicy.requiredMeals,
    isFullExplorationDay: dayMealPolicy.isFullExplorationDay,
    arrivalTime24: facts.flightContext?.arrivalTime24 || null,
    departureTime24:
      facts.flightContext?.returnDepartureTime24 ||
      facts.flightContext?.returnDepartureTime ||
      null,
    generated_at: new Date().toISOString(),
  };
}
```

**2. `supabase/functions/generate-itinerary/action-save-itinerary.ts`** — prefer cached policy at line 297

```ts
// RS.M.I3: prefer the meal policy cached at generation. Re-deriving here
// against current flight times silently disagrees with what the AI was
// instructed to produce when the user changes flights between gen and save.
const cachedPolicy = (day as any)?.metadata?.quality?.meal_policy_at_generation;
const policy = cachedPolicy && Array.isArray(cachedPolicy.requiredMeals)
  ? {
      dayMode: cachedPolicy.dayMode,
      requiredMeals: cachedPolicy.requiredMeals as RequiredMeal[],
      isFullExplorationDay: !!cachedPolicy.isFullExplorationDay,
      // remaining MealPolicy fields aren't read by the meal-guard branch below
    } as any
  : deriveMealPolicy({
      dayNumber,
      totalDays,
      isFirstDay,
      isLastDay,
      arrivalTime24: isFirstDay ? savedArrivalTime24 : undefined,
      departureTime24: isLastDay ? savedDepartureTime24 : undefined,
    });
```

### Notes

- Stamping at the generation boundary (action-generate-day.ts) — not inside compile-prompt.ts — keeps the prompt builder pure and avoids mutating an object that compile-prompt.ts doesn't own.
- The cached shape is intentionally a subset of `MealPolicy`. The save-time consumer only reads `requiredMeals` (line 306, 312) and never references `usableHours` / `mealInstructionText` etc., so a partial restore is safe. If a future caller reads more fields, it can fall through to a `deriveMealPolicy` re-derive.
- Backward-compatible: days saved before this change have no cached policy and fall through to the existing re-derive — no migration needed.
- Manual / locked / extracted activities continue to flow through the meal guard exactly as before; this change only swaps the source of `requiredMeals`.

### Verify

```bash
grep -rc "meal_policy_at_generation" supabase/functions/generate-itinerary/ \
  | awk -F: '{s+=$2} END {print s}'
```
Expect ≥ 2 (will be 2: one in `action-generate-day.ts`, one in `action-save-itinerary.ts`).
