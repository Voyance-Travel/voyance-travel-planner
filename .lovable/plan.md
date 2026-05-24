Root cause to fix systematically:

- The 504 means the `generate-itinerary` function timed out after the day rows were already written.
- For trip `99c9d333-0606-4e6f-912d-cab428f0190b`, the database has all 4 `itinerary_days` and real `itinerary_activities` rows, but `trips.itinerary_data.days` is empty and `itinerary_status='partial'` with stale `failed_day_numbers=[2,3,4]`.
- The UI currently sees 4 completed table days, shows the celebration state, then waits forever for `itinerary_data.days` to appear. On refresh, the missing JSON makes the app fall back toward “plan from scratch.”
- The `<circle cy/r undefined>` warnings are secondary UI animation noise from the generation animation; they are not the cause of the stuck trip, but I’ll harden that too.

Plan:

1. Add a single frontend recovery helper for “table-complete but JSON-empty” trips
   - Create a shared helper that reads `itinerary_days` + `itinerary_activities`, groups rows by day, converts them back into canonical `itinerary_data.days`, and validates:
     - expected day count from trip dates / metadata
     - every expected day exists
     - each day has real activities, not shell rows
   - This avoids duplicating ad hoc rebuild logic across `TripDetail` and `ItineraryGenerator`.

2. Make the generator spinner exit when normalized tables are complete
   - Update `ItineraryGenerator.recoverFromDatabase()` so if `itinerary_data.days` is empty/truncated but normalized tables are complete, it rebuilds and persists the JSON through `safeUpdateItineraryData`.
   - Then call `onComplete(rebuiltDays)` instead of staying on the “Your itinerary is ready / Loading your itinerary...” screen forever.

3. Make `TripDetail` recover partial/failed/generating trips, not only ready trips
   - Today the self-heal rebuild is mostly gated behind `ready/generated` status.
   - Expand it so `partial`, `failed`, and stale `generating` trips can be promoted when the normalized tables prove all expected days are complete.
   - Persist repaired metadata:
     - clear stale `failed_day_numbers`
     - set `generation_completed_days = totalDays`
     - set `itinerary_status = ready`
     - stamp `fully_persisted = true` after successful JSON rebuild

4. Fix the poller’s completion model
   - `useGenerationPoller` should not enter endless celebration when `status='partial'` but `itinerary_days.count >= totalDays`.
   - Add a “recoverable complete” branch: if table days are complete and activity rows exist for each day, trigger completion/recovery instead of returning `partial`.
   - Keep the existing shell-row protections so empty placeholder days never masquerade as real completion.

5. Harden the generation animation warnings
   - Clamp `progress` and all animated circle attributes to finite numeric defaults before passing them to `motion.circle`.
   - This removes the noisy `<circle> attribute cy/r: Expected length, "undefined"` errors so real backend failures are easier to spot.

6. Add regression tests
   - Test the “Bangkok/Dubai class” case: `itinerary_data.days=[]`, status `partial`, table has 4 days with activities → rebuilds 4 days and marks ready.
   - Test shell rows: table has 4 days but zero activities → does not mark ready.
   - Test `GenerationAnimation` finite fallback behavior for undefined/NaN progress.

Immediate expected outcome after implementation:

- The Dubai trip should load all 4 days from normalized tables instead of getting stuck or falling back to “plan from scratch.”
- Future 504s after successful day-row writes should self-complete safely instead of charging credits and leaving the user stranded.