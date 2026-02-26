# Schema Unification Audit — All 4 Itinerary Creation Flows

**Date:** 2026-02-26  
**Status:** Audit complete, ready for incremental fixes

---

## Executive Summary

The codebase is **closer to unified than expected**. All 4 flows write to the same `trips` table and share the same `itinerary_data` JSONB structure (`BackendDay[]` → `BackendActivity[]`). The "choice/radio-button" schema **does not exist** — it was already removed or never shipped. The primary divergence is around **multi-city data** (`trip_cities` table) and **field population completeness**.

---

## Flow-by-Flow Analysis

### Flow 1: "Build It Myself" (Single City — `/start`)
- **Entry:** `src/pages/Start.tsx` → `useCreateTrip()` hook
- **Trip creation:** `voyanceAPI.createTrip()` → inserts into `trips` table
- **Fields set:** `name`, `destination`, `start_date`, `end_date`, `travelers`, `origin_city`, `budget_tier`, `trip_type`, `creation_source`, `is_multi_city=false`
- **trip_cities:** ❌ NOT populated for single-city
- **Flight data:** Saved to `trips.flight_selection` (legs[] format) ✅
- **Hotel data:** Saved to `trips.hotel_selection` (array format) ✅
- **Generation:** Progressive day-by-day via `useItineraryGeneration` → `generate-day` edge function
- **itinerary_data shape:** `{ days: BackendDay[], overview: {...} }` ✅

### Flow 2: "Build It Myself" (Multi-City — `/start`)
- **Entry:** Same as Flow 1, but `isMultiCity=true`
- **Trip creation:** Same `voyanceAPI.createTrip()` → same `trips` table
- **Fields set:** Same as Flow 1 + `is_multi_city=true`, `destinations` JSONB
- **trip_cities:** ✅ Populated with per-city rows (city_order, nights, transport, dates)
- **Flight data:** Same legs[] format ✅
- **Hotel data:** Per-city hotel in `trip_cities.hotel_selection` (separate from `trips.hotel_selection`)
- **Generation:** Same progressive pipeline, but with city-aware day mapping
- **itinerary_data shape:** Same `{ days: BackendDay[], overview: {...} }` ✅

### Flow 3: "Just Tell Us" (Chat — `/start`)
- **Entry:** `src/pages/Start.tsx` → chat extracts details → same form submit
- **Trip creation:** Same `voyanceAPI.createTrip()` → same `trips` table
- **Fields set:** Same as Flow 1 (chat populates the same form state)
- **trip_cities:** ❌ NOT populated (even if chat mentions multiple cities)
- **Flight/Hotel:** Same format ✅
- **Generation:** Same progressive pipeline ✅
- **itinerary_data shape:** Same ✅

### Flow 4: Mystery Getaway (`/profile` → `MysteryGetawayModal`)
- **Entry:** `src/components/profile/MysteryGetawayModal.tsx`
- **Trip creation:** `useCreateTrip()` → same `voyanceAPI.createTrip()`
- **Fields set:** `name`, `destination`, `startDate`, `endDate`, `travelers=1`, `budgetTier='moderate'`
- **Missing fields vs other flows:**
  - ❌ `origin_city` — not always set (only if user entered departure city)
  - ❌ `trip_type` — not set
  - ❌ `creation_source` — not set (should be `'mystery_getaway'`)
  - ❌ `is_multi_city` — not set (defaults to null, not false)
- **trip_cities:** ❌ NOT populated
- **Flight data:** Not collected ✅ (expected — mystery trip)
- **Hotel data:** Saved to `trips.hotel_selection` in array format ✅
- **Generation:** Navigates to `/trip/:id?generate=true` → same progressive pipeline ✅
- **itinerary_data shape:** Same ✅

### Flow 5 (Bonus): Manual Paste (`/start` → paste mode)
- **Entry:** `src/components/planner/ManualTripPasteEntry.tsx` → `createTripFromParsed()`
- **Trip creation:** Direct `supabase.from('trips').insert()` (bypasses `voyanceAPI.createTrip()`)
- **Fields set:** `name`, `destination`, `start_date`, `end_date`, `travelers`, `trip_type`, `budget_tier`, `creation_source='manual_paste'`, `itinerary_data` (pre-populated)
- **Missing fields vs other flows:**
  - ❌ `origin_city` — not set
  - ❌ `is_multi_city` — not set
  - ❌ `owner_plan_tier` — not set (voyanceAPI.createTrip fetches this, but manual paste bypasses it)
- **trip_cities:** ❌ NOT populated
- **itinerary_data shape:** Similar but uses slightly different field names:
  - Uses `title` instead of `name` for activity naming
  - Uses `cost: { amount, currency }` instead of `estimatedCost: { amount, currency }`
  - Uses `source: 'parsed'` marker on activities
  - Activities have `startTime` AND `time` (redundant)
  - Missing: `coordinates`, `venue`, `photos`, `walkingDistance`, `walkingTime`

---

## Divergence Matrix

| Field/Feature | Build Single | Build Multi | Just Tell Us | Mystery | Manual Paste |
|---|---|---|---|---|---|
| `trips` table insert | ✅ via API | ✅ via API | ✅ via API | ✅ via API | ⚠️ direct insert |
| `creation_source` | ✅ set | ✅ set | ✅ set | ❌ missing | ✅ set |
| `is_multi_city` | ✅ false | ✅ true | ❌ not set | ❌ not set | ❌ not set |
| `trip_type` | ✅ set | ✅ set | ✅ set | ❌ missing | ✅ set |
| `origin_city` | ✅ set | ✅ set | ✅ set | ⚠️ optional | ❌ missing |
| `owner_plan_tier` | ✅ set | ✅ set | ✅ set | ✅ set | ❌ missing |
| `trip_cities` rows | ❌ none | ✅ populated | ❌ none | ❌ none | ❌ none |
| `flight_selection` | ✅ legs[] | ✅ legs[] | ✅ legs[] | ❌ none | ❌ none |
| `hotel_selection` | ✅ array | ⚠️ in trip_cities | ✅ array | ✅ array | ❌ none |
| `itinerary_data` shape | ✅ canonical | ✅ canonical | ✅ canonical | ✅ canonical | ⚠️ slightly different |
| Activity field names | `name` | `name` | `name` | `name` | `title` |
| Cost field | `estimatedCost` | `estimatedCost` | `estimatedCost` | `estimatedCost` | `cost` |

---

## `isMultiCity` Branching Locations

These are all the places that branch on `isMultiCity`, creating dual code paths:

1. **`src/hooks/useItineraryGeneration.ts`** — Fetches `trip_cities` only if multi-city; builds city payload
2. **`src/hooks/useProgressiveItinerary.ts`** — Same pattern
3. **`src/services/itineraryAPI.ts`** — Builds `dayCityMap` only if multi-city
4. **`src/pages/Start.tsx`** — Inserts `trip_cities` only if multi-city
5. **`supabase/functions/generate-itinerary/index.ts`** — Uses `cities[]` payload when present, falls back to `destination` string
6. **`src/components/itinerary/FullItinerary.tsx`** — Flight display changes for multi-city
7. **`src/contexts/TripPlannerContext.tsx`** — Tracks `isMultiCity` in planner state

---

## Recommended Fixes (Priority Order)

### P0: Field Population Gaps
1. **Mystery Getaway** — Set `creation_source: 'mystery_getaway'`, `trip_type: 'leisure'`, `is_multi_city: false`
2. **Manual Paste** — Set `is_multi_city: false`, `owner_plan_tier`, route through `voyanceAPI.createTrip()` or duplicate its logic

### P1: Activity Schema Normalization (Manual Paste)
3. **`createTripFromParsed`** — Normalize activity fields to match canonical schema:
   - `title` → `name`
   - `cost: {amount, currency}` → `estimatedCost: {amount, currency}`
   - Remove redundant `time` field (keep `startTime`)
   - Add `coordinates: null`, `venue: null` placeholders

### P2: Single-City trip_cities Population
4. **All single-city flows** — After creating a trip with `is_multi_city=false`, also insert ONE `trip_cities` row. This allows removing all `if (isMultiCity)` guards in generation hooks.

### P3: Remove isMultiCity Branching
5. **Generation hooks** — Always read `trip_cities`; if 1 row → single city, if N rows → multi-city. Remove the boolean check.
6. **Edge function** — Always expect `cities[]` payload (even with 1 entry).

---

## What's Already Good

- ✅ All flows use the same `trips` table
- ✅ All flows produce the same `itinerary_data.days[]` structure after generation
- ✅ `BackendDay` / `BackendActivity` types are shared and well-defined
- ✅ No "choice pair" or radio-button schema exists
- ✅ Flight data uses unified `legs[]` format
- ✅ Hotel data uses array format (with `normalizeLegacyHotelSelection`)
- ✅ The edge function's `generate-day` action works identically regardless of creation flow
- ✅ `convertBackendDay` / `convertBackendActivity` provide a single rendering path

---

## Estimated Effort

| Fix | Effort | Risk |
|---|---|---|
| P0: Field gaps | ~30 min | Very low |
| P1: Manual paste normalization | ~1 hour | Low |
| P2: Single-city trip_cities | ~2 hours | Medium (migration + all flows) |
| P3: Remove isMultiCity branching | ~4 hours | Medium-high (touches generation pipeline) |
