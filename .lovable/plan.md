

## Fix Day Count Pipeline + Hotel Name Not Passed to Generation

### Bug 1a: Chat multi-city `days_total` stores nights instead of nights+1
**File:** `src/pages/Start.tsx` line 2697
- `days_total: city.nights` → `days_total: (city.nights || 1) + 1`

### Bug 1b: Chat single-city `days_total` stores nights instead of nights+1  
**File:** `src/pages/Start.tsx` line 2728
- `days_total: nights` → `days_total: nights + 1`

### Bug 2: Single-city `trip_cities` row missing `hotel_selection`
**File:** `src/pages/Start.tsx` lines 2463-2473
- Add `hotel_selection: hotelSelection && hotelSelection.length > 0 ? hotelSelection : null` to the `singleCityRow` object
- The `hotelSelection` variable is already in scope (defined at line 2307)

### Bug 3: `useItineraryGeneration.ts` confuses nights vs days_total in fallback
**File:** `src/hooks/useItineraryGeneration.ts`
- **Line 176:** Replace `c.nights || c.days_total || 1` with proper derivation: if `nights` is missing, use `(days_total - 1)` since days_total is inclusive
- **Line 185:** Same fix for the per-city loop variable

All fixes are isolated find-and-replace changes with no structural impact.

