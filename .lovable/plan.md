
Issue rephrased: this is not just a “meal bug.” The last days are becoming “Unplanned” because the app still has competing itinerary sources, and one recovery path can overwrite good JSON days with empty table-backed days.

Do I know what the issue is? Yes.

What I verified
- The current trip already has 4 JSON days, and days 3–4 contain real activities in `trips.itinerary_data`.
- But the normalized backend tables are out of sync:
  - `itinerary_activities` has 0 rows for all 4 days on this trip.
  - trip metadata still says `generation_completed_days = 2` while status is `ready`.
- `TripDetail.tsx` still has two direct write/self-heal paths that bypass the canonical backend save.
- `TripDetail.tsx` rebuilds JSON from `itinerary_days.activities`, but the actual normalized child records live in `itinerary_activities`.

Exact problem
1. Full generation chain saves JSON progress in `action-generate-trip-day.ts`, but it does not keep normalized tables in sync at completion.
2. Frontend self-heal in `TripDetail.tsx` can rebuild `itinerary_data.days` from empty/stale table data.
3. Auto-regeneration in `TripDetail.tsx` still writes merged `itinerary_data` directly to the trip row, bypassing backend normalization/sync.
4. Result: end-of-trip days can flip back to empty/unplanned even after generation produced real activities.

Implementation plan
1. Make chain completion sync the normalized tables
- Update `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- After saving the final `partialItinerary`, call the same table sync used by `save-itinerary`
- Also update metadata so `generation_completed_days` always matches actual completed days

2. Stop `TripDetail` from rebuilding JSON from the wrong source
- Update `src/pages/TripDetail.tsx`
- Replace the current “rebuild from `itinerary_days.activities`” logic with one of:
  - preferred: join `itinerary_days` + `itinerary_activities` properly, or
  - safer: disable rebuild unless table activity rows are actually present
- Never overwrite populated JSON with empty table-derived days

3. Route the remaining frontend recovery save through backend
- Update `src/pages/TripDetail.tsx`
- The auto-regenerate block for empty days should call backend `save-itinerary` instead of direct `trips.itinerary_data` update
- That ensures normalization, meal guard, and sync all run

4. Tighten “Unplanned day” detection
- In UI logic, treat a day as unplanned only when it truly has no persisted activities
- Do not let stale table summaries outrank richer JSON day data

5. Add regression coverage
- Test full 4-day generation finishes with 4 persisted days
- Test final days do not revert to “Unplanned” after page reload
- Test self-heal does not clobber populated JSON from empty tables
- Test auto-regenerated empty days persist through backend save path

Files to change
- `src/pages/TripDetail.tsx`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- possibly `supabase/functions/generate-itinerary/action-sync-tables.ts` if the rebuild path needs a richer canonical sync contract

Technical notes
```text
Current failure:
generate days -> JSON has activities
-> tables not synced / metadata stale
-> TripDetail self-heal reads empty table-backed days
-> direct frontend update overwrites JSON
-> day tabs show “Unplanned”

Target flow:
generate days
-> final backend save/sync updates JSON + normalized tables together
-> self-heal only trusts complete sources
-> any recovery save goes through backend
-> reload still shows fully planned days
```

Why this plan is different from prior fixes
Previous fixes focused on meal enforcement or premature completion. The remaining bug is a persistence/recovery bug:
- good generated days exist,
- but the frontend can still overwrite them from stale normalized data,
- and the chain still doesn’t fully close the loop between JSON, tables, and metadata.
