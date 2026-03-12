
Root cause identified: this is not a frontend poller bug. The poller is correctly reporting a backend 500 from the itinerary function.

What is failing:
- `generate-itinerary` throws `ReferenceError: normalizedActivities is not defined`.
- Logs point to `supabase/functions/generate-itinerary/index.ts` around lines `~5725` and `~5761`.
- The new “meal dedup + final chronological sort” block is currently placed near the top of `generate-day` (right after auth/access checks), before `normalizedActivities` is created.
- `meal-dedup` warning is caught, but the standalone final sort runs outside that try/catch and crashes the request, causing `Day 1 HTTP 500` and then `Generation failed 0`.

Implementation plan:
1. Remove the misplaced block in `generate-day`:
   - `STEP: MEAL DEDUPLICATION — Safety net for duplicate dining`
   - `STEP: FINAL CHRONOLOGICAL SORT (Fix 23L)`
   - currently around `6415–6482`.

2. Reinsert that exact logic at the correct point:
   - after buffer enforcement completes (`normalizedActivities = sorted;` and its catch),
   - immediately before `STEP: ENRICH NEW ACTIVITIES`,
   - where `normalizedActivities` is guaranteed to exist.

3. Keep the final sort inside safe scope:
   - either inside the same try/catch as dedup, or a dedicated guarded block,
   - so no uncaught reference/runtime error can terminate day generation.

4. Validate runtime behavior:
   - invoke `generate-day` and `generate-trip-day` for the failing trip flow,
   - confirm no `normalizedActivities` ReferenceError in function logs,
   - confirm day generation proceeds past post-processing into enrichment/save.

5. Verify output quality still matches Fix 23L intent:
   - one meal per window,
   - no back-to-back duplicate dining (except locked/must-do),
   - chronological ordering preserved.

Note:
- The React ref warnings in `Home/SampleArchetype` are separate UI warnings and not the cause of the generation 500.
