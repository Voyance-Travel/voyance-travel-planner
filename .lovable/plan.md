

## Fix: Multi-City Credit Display Bugs

### Bugs Found

**Bug 1: `ItineraryGenerator.tsx` line 299** — For multi-city trips, `cities` is passed as `[]` (empty array), so `calculateTripCredits` computes 0 multi-city fee. The confirmation dialog shows the wrong total.

```typescript
// Current (broken)
const cities = isMultiCity ? [] : [destination];
return calculateTripCredits({ days: totalDaysEstimate, cities });
```

**Bug 2: `ItineraryGenerator.tsx` lines 494-499** — Journey leg breakdown calculates each leg with `cities: [leg.destination]` (1 city each), so no multi-city fee is ever included in the per-leg or total cost.

**Bug 3: `TripCostEstimate.tsx` line 30** — Uses raw `paidDays * BASE_RATE_PER_DAY` instead of `calculateTripCredits()`, completely ignoring multi-city fees and complexity multipliers. Also doesn't accept a `cities` prop at all.

### Plan

**File 1: `src/components/itinerary/ItineraryGenerator.tsx`**
- Line 299: Replace `isMultiCity ? [] : [destination]` with actual city list. Need to find where multi-city destinations are available — check if `tripCities` from `useTripCities` hook is available, or derive from `journeyLegs`.
- Lines 494-499: After computing per-leg costs, add the multi-city fee to the total. The fee applies to the journey as a whole (based on number of cities), not per-leg.

**File 2: `src/components/planner/TripCostEstimate.tsx`**
- Accept an optional `cities` prop (default `['single']` to keep backward compat).
- Replace manual `paidDays * BASE_RATE_PER_DAY` with `calculateTripCredits({ days: paidDays, cities }).totalCredits` to include multi-city fees.

**File 3: `src/pages/Start.tsx`**
- Pass the selected cities array to `TripCostEstimate` so it can compute multi-city fees. Need to check what city data is available at render time.

### Investigation needed before implementation
- Check what city list is available in `ItineraryGenerator` (line 299 context) — likely from `useTripCities` or journey legs.
- Check what city data is available in `Start.tsx` where `TripCostEstimate` is rendered.

