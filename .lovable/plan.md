

## Plan: Database Query Efficiency + Frontend Caching

### Part 1: Lightweight trip query for dashboard
**File: `src/services/supabase/trips.ts`**

Add `getTripsLightweight()` after `getTrips()` (line ~258). Selects all columns EXCEPT `itinerary_data` (the 50-100KB JSON blob). The dashboard only uses `!!row.itinerary_data` as a boolean, so we'll check for null in the select.

Columns to select (based on actual trips schema and dashboard usage at lines 823-847):
`id, user_id, name, origin_city, destination, destination_country, start_date, end_date, travelers, trip_type, budget_tier, status, itinerary_status, flight_selection, hotel_selection, price_lock_expires_at, metadata, journey_id, journey_name, journey_order, journey_total_legs, transition_mode, creation_source, is_multi_city, created_at, updated_at`

Note: `itinerary_data` is intentionally excluded. The dashboard checks `!!row.itinerary_data` — we'll handle this by adding `itinerary_data:itinerary_status` won't work. Instead, we check `itinerary_status === 'ready'` as a proxy for "has itinerary data", or use a computed approach. Simplest: still fetch `itinerary_data` but as a null check — actually Supabase doesn't support computed columns in select. We'll map `hasItineraryData` based on `itinerary_status` being `'ready'` or `'partial'`.

Add `useTripsLightweight()` hook with `staleTime: 60_000`.

### Part 2: Use lightweight query in TripDashboard
**File: `src/pages/TripDashboard.tsx`**

Replace the `select('*')` at line 754-759 with the explicit column list (same as Part 1, excluding `itinerary_data`). Change `hasItineraryData: !!row.itinerary_data` to `hasItineraryData: row.itinerary_status === 'ready'`.

Same for the collab trips query at lines 764-772 — replace `trips!trip_collaborators_trip_id_fkey(*)` with the explicit lightweight column list.

### Part 3: Smarter cache invalidation
**File: `src/services/supabase/trips.ts`**

- Add `['trips-lightweight']` invalidation alongside every existing `['trips']` invalidation (lines 416, 466, 481)
- Increase `useTrips()` staleTime from 30s to 120s (line 388)
- Increase `useTrip()` staleTime from 30s to 120s and add `gcTime: 600_000` (line 397)

**Files with other invalidations** (add `trips-lightweight` alongside):
- `src/services/saveTripAPI.ts` (line 136)
- `src/components/itinerary/SmartFinishBanner.tsx` (lines 337, 388)
- `src/services/plannerAPI.ts` (lines 196, 210)
- `src/services/tripSharingAPI.ts` (line 571)

### Part 4: Fix polling + realtime overlap
**File: `src/hooks/useGenerationPoller.ts`**

- Change fallback polling interval from 2s to 8s (line 327-329): `setInterval(() => poll(), 8000)`
- Add debounce for realtime-triggered polls: add a `lastRealtimePoll` ref, create `debouncedPoll()` that throttles to max once per 3 seconds
- Replace all three realtime `poll()` calls (lines 361, 374, 387) with `debouncedPoll()`

### Expected Impact
- Dashboard payload: ~97% reduction (exclude 50-100KB `itinerary_data` per trip)
- Generation polling: ~75% reduction (8s fallback + 3s debounce vs 2s polling + instant realtime)
- Cache efficiency: longer stale times reduce redundant refetches

