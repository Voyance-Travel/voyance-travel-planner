
Goal: fix the missing Day 2 US Open card without reintroducing the broader itinerary regressions from Fix 11.

What I confirmed from the actual data
- The PDFs for itinerary 7 and 8 show the same pattern on Day 2: transit into the tournament, a long empty tournament window, then transit back out.
- The latest trip metadata has a contradiction:
  - `mustDoActivities` correctly includes `US Open tennis 9am-5pm Day 2`
  - `generationRules` for Day 2 incorrectly store `blocked_time` as `09:00 -> 11:00` with reason `US Open tennis tournament from 9am to 5pm.`
- The saved Day 2 JSON contains the inbound transit and outbound transit, but no actual US Open activity card.
- So this is not a UI/rendering issue. The generator is getting conflicting instructions and honoring the shorter blocked window.

Why Day 1 and Day 3 still look okay
- Day 1 has arrival pressure and Day 3 has departure pressure, so the model still tends to place the tennis block.
- Day 2 is the only clean full day, so the bad `09:00–11:00` rule leaves a huge gap that the model fills with breakfast/evening structure and no event card.

Plan
1. Do not bring Fix 11 back as-is
- Fix 11’s itinerary-shaping logic was too aggressive.
- The hard-assignment / stripping / backfill changes should stay rolled back for now.
- Only the safe cleanup pieces are worth keeping: NaN-time sanitization and safer duration coercion.

2. Make one surgical fix for existing trips
- In `supabase/functions/generate-itinerary/budget-constraints.ts`, repair `blocked_time` when the stored rule is obviously truncated.
- When a blocked-time rule’s `reason` or `description` contains an explicit range like `9am to 5pm`, parse that range and override the emitted prompt window.
- That means the generator will see `09:00–17:00` for Day 2 even if the saved metadata still says `09:00–11:00`.
- This fixes the current trip without touching the database or reintroducing Fix 11 behavior.

3. Prevent future bad metadata
- In `supabase/functions/chat-trip-planner/index.ts`, extend `userConstraints` for `time_block` to support `endTime` and `duration`.
- In `src/pages/Start.tsx`, when converting `time_block` into `generationRules`:
  - prefer explicit `endTime`
  - otherwise parse a time range from the constraint description
  - only then fall back to duration/default math
- This prevents future trips from saving the wrong `to` time in the first place.

4. Keep the must-do system simple for now
- Do not add more scheduler logic.
- Do not hard-assign days again.
- Do not add synthetic backfill again yet.
- First remove the conflicting short blocked window and let the model generate the tournament card naturally.

Files to change
- `supabase/functions/generate-itinerary/budget-constraints.ts`
- `supabase/functions/chat-trip-planner/index.ts`
- `src/pages/Start.tsx`
- If needed, explicitly revert the remaining Fix 11 itinerary-shaping code still present in:
  - `supabase/functions/generate-itinerary/must-do-priorities.ts`
  - `supabase/functions/generate-itinerary/index.ts`

Validation plan
- Regenerate the same trip after the prompt-window repair.
- Confirm Day 2 now contains a real US Open activity between the inbound and outbound transit.
- Confirm Day 1 and Day 3 stay close to itinerary 7 quality, rather than itinerary 8’s more degraded structure.
- Confirm newly planned trips save correct blocked windows in metadata, not `09:00–11:00` when the text says `9am–5pm`.

Recommendation
- Treat this as a source-data conflict fix, not another must-do scheduling fix.
- The narrowest safe move is: repair the blocked-time prompt first, test on the same trip, and only revisit scheduling if the event still fails to appear.
