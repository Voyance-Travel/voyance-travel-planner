
Root cause is now clearer, and it explains why this has felt like the “same fix” over and over.

What I verified
- The backend meal guard is firing. Recent logs show Day 4 missing breakfast/lunch/dinner and the guard injecting them successfully.
- But the saved trip data is still inconsistent:
  - Recent Tokyo trip has Day 3 and Day 4 with meals injected, but their `date` fields are blank in `trips.itinerary_data`.
  - Recent Paris trip still has Day 3 and Day 4 saved as empty days with 0 activities.
- The table state is also broken: `itinerary_days` rows exist, but related activities are effectively absent, and one runtime error shows:
  - `null value in column "date" of relation "itinerary_days" violates not-null constraint`

What that means
This is not just “meal logic failing.”
It’s a persistence architecture problem:
1. Meals may be added in `generate-day`
2. But later saves can still overwrite or persist malformed days
3. Some frontend code still writes directly to `trips.itinerary_data` instead of always using the backend save action
4. The canonical tables and JSON snapshot are drifting apart
5. Blank/malformed `date` values are causing partial persistence failures, which then leaves days empty or inconsistent

Why it keeps recurring
Because fixes have mostly added more guards around meal injection, but the app still has multiple save/generation paths. So the meal rule can work in one path and still be lost in another.

Implementation plan

1. Make backend save the only canonical write path
- Stop direct frontend writes to `trips.itinerary_data` for itinerary generation/edit flows.
- Route saves through `save-itinerary` everywhere practical, especially:
  - `EditorialItinerary.tsx` autosave/manual save
  - regeneration flows
  - assistant action edits
- This ensures every write passes the same backend validation.

2. Add canonical day normalization before every backend write
- In backend save/generation handlers, normalize every day before persistence:
  - ensure `dayNumber`
  - ensure non-empty `date` derived from trip start date when missing
  - preserve `status`
  - sort activities
- This directly addresses the blank-date corruption I found in recent trips.

3. Make meal compliance run after normalization and before persistence
- Keep meal enforcement, but move the guarantee to the true final persistence layer.
- If a full exploration day is still missing breakfast/lunch/dinner after all mutations, inject there.
- If a day is malformed enough that policy can’t be applied safely, fail the save instead of silently persisting broken data.

4. Re-sync JSON and itinerary tables from one source of truth
- When saving a trip, write both:
  - `trips.itinerary_data`
  - `itinerary_days` / `itinerary_activities`
- Ensure save succeeds transactionally in practice: no “JSON says meals exist, tables say nothing” drift.
- Add logging when either side diverges or table upserts fail.

5. Audit and reduce legacy `generate-day` callers
I found many direct `generate-day` callers still active in:
- `src/hooks/useItineraryGeneration.ts`
- `src/hooks/useUnlockTrip.ts`
- `src/hooks/useUnlockDay.ts`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/services/itineraryAPI.ts`
- others

Plan:
- keep generation flexible,
- but standardize the post-generation save contract so all these paths end in the same backend persistence function.

Files to update
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/index.ts`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/services/itineraryAPI.ts`
- `src/services/itineraryActionExecutor.ts`
- possibly `src/hooks/useItineraryGeneration.ts`, `useUnlockTrip.ts`, `useUnlockDay.ts`

Expected result
- Full exploration days will reliably persist with breakfast, lunch, and dinner.
- Days won’t be saved with blank dates.
- The UI JSON snapshot and backend itinerary tables will stay aligned.
- We’ll stop “fixing meals” in one layer while another layer keeps re-breaking them.

Technical note
The strongest concrete bug I found is this combination:
- meal guard injects correctly
- generated days can still be saved with missing/blank `date`
- `itinerary_days` upsert then fails on not-null date
- frontend still has direct save paths that bypass the canonical backend save enforcement

So the next fix should be framed as a persistence unification fix, not another meal-keyword fix.
