## Plan

1. **Add a reliability guard to Trip Health meal checks**
   - Treat meal-related health issues as advisory only when the saved day is known partial/incomplete or when canonical meal rows are missing from the displayed itinerary but present in normalized activity storage.
   - Do not let those meal artifacts deduct from the health score.
   - Keep true empty-day and real timing/conflict issues visible.

2. **Make health analysis use canonical parsed activity fields only**
   - Continue ignoring stale legacy `time` when `startTime` exists.
   - Add regression coverage for the Casablanca case where rendered times are already cascade-correct and stale fields still exist.
   - Ensure the score is derived from the same `healthIssues` list the UI actually displays.

3. **Harden departure-day interpretation**
   - If the last day has checkout/airport/departure logistics and no timed dining after the departure cutoff, suppress “missing dinner/lunch” health errors rather than scoring them as content problems.
   - Add a regression test for an afternoon-departure day with breakfast/logistics only.

4. **Prevent sparse JSON from poisoning health score**
   - Tighten the existing sparse-itinerary resync threshold so a displayed day that has fewer meal/activity rows than the normalized table is rebuilt from the richer source before Health scoring.
   - Preserve the frozen-trip guard by routing any self-heal through the existing safe update path and skip ledger mutation.

5. **Validate against the Casablanca fixture**
   - Add/adjust tests that assert the five reported Casablanca health issues collapse to zero actionable health problems after parsing/render-time canonicalization.
   - Run the focused TripHealthPanel and itinerary parser tests only.