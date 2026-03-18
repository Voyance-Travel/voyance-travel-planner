

## Fix: Date Changes Not Captured by Undo System

### Root Cause

The version history system (`itinerary_versions` table) is scoped per-day — it stores `activities` and `day_metadata` (title/theme) but has no concept of trip-level fields like `start_date`/`end_date`. The `handleDateChange` function in `TripDetail.tsx` (line 1738) updates the trip dates and restructures days but never saves version snapshots before making changes. When undo runs, it restores per-day activities but the trip dates remain at their new values.

### Approach

Save a **trip-level snapshot** before date changes and restore it on undo. This requires:

1. **New DB table: `trip_date_versions`** — stores trip-level date snapshots alongside the existing per-day version system.

2. **Save snapshot before date change** — in `handleDateChange`, save the current `start_date`, `end_date`, and full `itinerary_data` (including day structure) before applying the change.

3. **Restore dates on undo** — when undoing, check if the version being restored has an associated trip-date snapshot and restore `start_date`/`end_date` on the trip as well.

### Technical Details

**New table: `trip_date_versions`**
```sql
CREATE TABLE public.trip_date_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  day_count integer NOT NULL,
  hotel_selection jsonb,
  created_at timestamptz DEFAULT now(),
  created_by_action text DEFAULT 'date_change'
);

ALTER TABLE public.trip_date_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trip date versions"
  ON public.trip_date_versions FOR ALL TO authenticated
  USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE INDEX idx_trip_date_versions_trip ON public.trip_date_versions(trip_id, created_at DESC);
```

**File: `src/services/itineraryVersionHistory.ts`**
- Add `saveTripDateVersion(tripId, startDate, endDate, dayCount, hotelSelection)` function
- Add `getLastTripDateVersion(tripId)` to fetch the most recent pre-change snapshot
- Add `restoreTripDateVersion(tripId)` to pop the latest snapshot and return dates to restore

**File: `src/pages/TripDetail.tsx` — `handleDateChange`**
- Before any date manipulation, call `saveTripDateVersion()` to snapshot current `start_date`, `end_date`, and `hotel_selection`
- Also call `saveDayVersion()` for each existing day so per-day undo still works

**File: `src/pages/TripDetail.tsx` or `src/hooks/useVersionHistory.ts`**
- Add a trip-level undo handler that:
  1. Calls `restoreTripDateVersion()` to get the previous dates
  2. Updates the trip record with restored `start_date`/`end_date`
  3. Restores per-day activities via existing undo mechanism
  4. Invalidates query caches

**File: `src/components/itinerary/EditorialItinerary.tsx`**
- Wire the undo button to also trigger trip-date restoration when the last action was a date change (check `created_by_action` contains `date_change`)

### Result

After this fix, changing trip dates from Jul 1-5 to Jul 8-12 and clicking Undo will restore both the activities AND the date range back to Jul 1-5.

