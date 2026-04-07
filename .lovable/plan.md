
Problem confirmed:
- I checked the latest saved trip. Day 1 still has `Breakfast at a neighborhood café` at `08:30` and `Lunch at a bistro` at `12:30`, while the saved arrival flight lands at `13:44`.
- So the broken data is being reintroduced after the earlier placeholder/timing cleanup, not just slipping through once.

Do I know what the issue is? Yes.

What is actually wrong:
1. `supabase/functions/generate-itinerary/day-validation.ts` still has a separate generic fallback path inside `enforceRequiredMealsFinalGuard()`. When it cannot find a real venue, it literally creates titles like:
   - `Breakfast at a neighborhood café`
   - `Lunch at a bistro`
   These are the exact strings now showing up in the trip.
2. That meal guard runs after `universalQualityPass()` in `action-generate-day.ts`, and again in `action-generate-trip-day.ts` and `action-save-itinerary.ts`, so it can undo the placeholder fix we already added.
3. The same guard injects meals at fixed times (`08:30`, `12:30`, `19:00`) without respecting arrival/departure windows, which is why meals can appear before landing.
4. Timing/meal policy is inconsistent across the pipeline:
   - `compile-prompt.ts` uses resolved availability windows (`earliestFirstActivityTime` / `latestLastActivityTime`)
   - later guards recompute from raw flight times or weaker defaults
   That mismatch lets a later stage treat Day 1 like a fuller day than the prompt/flight logic intended.

Implementation plan:
1. Remove generic meal fallback titles entirely
   - Update `enforceRequiredMealsFinalGuard()` in `day-validation.ts`
   - Delete the branch that fabricates `at a bistro`, `at a neighborhood café`, etc.
   - Reuse only real-venue fallback sources from the existing restaurant pools / fallback DB logic

2. Make meal injection timing-aware
   - Pass resolved earliest/latest allowed times into the meal guard
   - Compute injected meal slots inside that allowed window instead of hardcoded `08:30 / 12:30 / 19:00`
   - If a meal does not fit the day window, skip it rather than forcing an impossible placement

3. Unify flight timing truth across the whole chain
   - Use one resolved timing source from `compile-day-facts.ts` / `flight-hotel-context.ts`
   - Feed that same timing window into:
     - `action-generate-day.ts`
     - `action-generate-trip-day.ts`
     - `action-save-itinerary.ts`
     - `universal-quality-pass.ts`

4. Add one terminal cleanup pass after all meal-guard mutations
   - After the final meal guard in each path, run a final scrub that guarantees:
     - no placeholder meals
     - no pre-arrival meals/activities
     - no post-departure activities
   - This closes the current gap where later stages can re-break earlier fixes

5. Align timing enforcement behavior
   - Standardize on the resolved available window instead of mixing raw arrival, arrival+2h, and prompt-only +4h logic across files
   - This prevents Day 1 from drifting between different timing rules depending on which stage touched it last

Files to update:
- `supabase/functions/generate-itinerary/day-validation.ts`
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/universal-quality-pass.ts`
- `supabase/functions/generate-itinerary/flight-hotel-context.ts`

Regression coverage to add:
- Arrival at `13:44` on Day 1 must not contain breakfast or lunch before landing
- Meal guard must never emit placeholder titles
- Trip-chain/save-time post-processing must not reintroduce placeholders after quality pass
- Final persisted itinerary must respect the same arrival/departure window used during prompt generation
