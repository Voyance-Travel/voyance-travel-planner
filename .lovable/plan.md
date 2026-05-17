## Plan: Make “Add your own must-dos” reliably affect generated itineraries

### Goal
When a user adds custom must-dos in the start flow, those requests should become structured generation intent and either appear in the itinerary or produce an explicit recoverable warning—not silently disappear.

### Changes
1. **Persist custom must-dos as structured day intents at trip creation**
   - In `src/pages/Start.tsx`, keep storing `metadata.mustDoActivities`, but also add a `metadata.userIntents` mirror for every selected landmark/custom must-do.
   - Use trip-wide `should` intents when no day/time is provided, and `must` only when the item includes a clear time or named venue.
   - This avoids relying only on the legacy must-do parser, which can schedule broad items unpredictably or skip them.

2. **Seed trip-wide must-do intents into each generated day’s Day Brief**
   - In `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`, include active trip-wide intent rows (`day_number is null`) as `USER WISHES` in the Day Brief, not just as note/constraint text.
   - This is the likely current leak: `trip_day_intents` can be non-empty but the compiler only injects day-specific rows into `ledger.userIntent`, so custom trip-wide must-dos never reach the per-day prompt as actionable wishes.

3. **Make legacy metadata seeding treat start-form must-dos as actionable wishes**
   - In `supabase/functions/_shared/intent-normalizers.ts`, ensure `metadata.mustDoActivities` entries become structured rows even when they are arrays from the form path.
   - Preserve the existing soft-vs-hard rule: vague items like “sushi lunch” stay unlocked wishes; explicit named/timed entries become stronger requirements.

4. **Add regression tests**
   - Add/update tests proving:
     - a start-form custom must-do becomes a structured intent row;
     - trip-wide `should` intents are injected into the Day Brief for generation;
     - existing day-specific/per-day activities remain unchanged and deduped.

5. **Verify against a recent trip**
   - Re-query a recent trip with custom must-dos and confirm `metadata.mustDoActivities`, `trip_day_intents`, and generated activities line up.
   - Confirm the fix does not create bare placeholder cards for vague must-dos.