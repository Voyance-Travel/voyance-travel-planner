
Root cause: this is two related logic gaps, not one missing prompt.

1. Hotel structure is still not guaranteed across every path
- The main repair pipeline does inject hotel structure in `pipeline/repair-day.ts`:
  - midday freshen-up/return between lunch and dinner
  - end-of-day return to hotel
  - check-in guarantee
  - checkout guarantee
- But the surrounding paths are inconsistent:
  - `action-generate-day.ts` validates with `hasHotel: !!flightContext.hotelName`, which is too narrow and can misclassify hotel context
  - `action-generate-trip-day.ts` only does light sanitizing before save and does not run the same full validate/repair guarantee layer there
  - frontend rewrite/regeneration preserves accommodation cards if they exist, but it does not create them if they never came back from the backend
- So the system can still save a day that has no hotel base at all.

2. Meal logic is validating duplicates but not fixing them
- `pipeline/validate-day.ts` correctly detects:
  - bad meal timing
  - missing meals
  - back-to-back duplicate meal types
- But `MEAL_DUPLICATE` is only a warning and `autoRepairable: false`.
- Meanwhile `enforceRequiredMealsFinalGuard()` only injects missing meals; it does not remove/replace duplicate dinners/lunches already present.
- Result:
  - a day can keep two dinners in a row
  - then still pass the final guard because “dinner exists”
  - so the itinerary remains logically broken as a real day

What I would change

1. Make hotel guarantees run in every generation/save path
- Reuse the same validate/repair pipeline guarantees for the chain path in `action-generate-trip-day.ts`, not just the single-day path.
- Ensure every saved/generated day passes through:
  - hotel check-in/check-out guarantee
  - midday rest/freshen-up guarantee on long/full days
  - end-of-day return-to-hotel guarantee
- This is the highest-value fix because right now the logic exists, but not consistently on every path.

2. Broaden hotel detection everywhere
- Replace narrow `!!flightContext.hotelName` checks with the broader hotel-presence logic already intended by product rules:
  - selected hotel
  - accommodation notes / parsed metadata
  - existing accommodation activities
  - multi-city resolved hotel selection
- Apply this consistently in validation inputs and phantom-hotel stripping decisions so valid placeholder hotel cards are never treated as suspect.

3. Turn duplicate same-meal detection into a repairable failure
- Upgrade same-meal back-to-back cases in `pipeline/validate-day.ts` from warning-only to repairable validation output.
- Add deterministic repair handling in `pipeline/repair-day.ts` for:
  - two dinners in a row
  - two lunches in a row
  - two breakfasts in a row
- Repair strategy:
  - if one of them is wrongly labeled for its time, relabel it to the correct meal
  - otherwise swap one meal to an unused restaurant from the pool if it should be a different slot
  - if the day already has the required meal count and an extra duplicate exists, remove or convert the redundant meal into a realistic non-meal/rest block

4. Add a true “day-shape” validator, not just meal presence
- Validate realistic pacing for a full day:
  - lunch and dinner should not sit back-to-back without an intervening activity or rest block
  - full exploration days should include either a midday hotel rest/freshen-up block or an explicit downtime gap before evening
  - dinner should generally be the last main meal of the day, not followed by another dinner card
- This should live next to `MEAL_ORDER` / `MEAL_DUPLICATE` logic, because the issue is not just naming — it is broken day structure.

5. Tighten the final meal guard so it cannot preserve nonsense
- Update `enforceRequiredMealsFinalGuard()` so it first normalizes the existing meal set before injecting anything:
  - detect duplicate meal types already present
  - avoid injecting into a day that already has an overfull or contradictory meal pattern
  - use canonical venue identity, not raw titles only, when deciding whether a meal already exists
- That makes the final guard a structural sanity pass instead of just a “missing meal inserter.”

6. Keep frontend preservation logic, but stop relying on it as the fix
- The frontend accommodation merge in:
  - `src/services/itineraryActionExecutor.ts`
  - `src/components/itinerary/ItineraryEditor.tsx`
is good for preserving hotel cards during rewrites.
- But it should remain a preservation layer only.
- The real fix must happen in backend generation/repair, because if the backend returns no hotel base cards, the frontend cannot invent the correct daily logic.

Files to update
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
- `supabase/functions/generate-itinerary/day-validation.ts`
- likely `supabase/functions/generate-itinerary/generation-utils.ts` for shared “has hotel context” logic

Expected result
- Every day has a hotel base:
  - check-in on entry days
  - freshen-up / return-to-hotel on long days
  - checkout on departure days
- Days stop feeling like endless motion with no rest anchor.
- Two dinners in a row becomes a fixable failure, not a tolerated warning.
- The final itinerary reads like a believable human day, not just a list of cards.
