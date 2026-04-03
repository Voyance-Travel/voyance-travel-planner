

## Fix: Accurate Transit Duration & City-Aware Pricing in Generation Pipeline

### Problem
The repair pipeline injects transit cards with **hardcoded 15-minute duration** and **$0 cost** regardless of actual distance between activities. Meanwhile, the frontend `transit-estimate` edge function uses Google Routes API for accurate durations but has hardcoded pricing formulas that ignore city-specific fares.

### Approach
Use **haversine distance** from activity coordinates (available after enrichment) to compute realistic transit durations and costs during generation. No API calls needed — coordinates are already on activities. Add a lightweight city-aware cost multiplier table for taxi/transit pricing.

### Changes

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

#### 1. Add `hotelCoordinates` to `RepairDayInput`

Pass the hotel's lat/lng into the repair pipeline so transit cards to/from the hotel can use real distance.

#### 2. Add haversine + heuristic transit helper

```text
function estimateTransit(
  fromCoords, toCoords, city?
) → { durationMinutes, method, cost }
```

- Compute haversine distance between activity coordinates
- Walking: `distance / 80` m/min (~5 km/h). Use if ≤ 1.2 km
- Transit: `distance / 500` m/min + 5 min overhead. Use if 1.2–8 km
- Taxi: `distance / 400` m/min + 3 min overhead. Use if > 8 km
- Minimum duration: 5 minutes
- Cost: apply city-tier multiplier (see below)

#### 3. Add city-aware cost multiplier table

```text
CITY_TRANSIT_TIERS = {
  // Tier 1: Expensive (NYC, London, Tokyo, Paris, Zurich...)
  expensive: { taxiPerKm: 3.5, transitFlat: 3.5 },
  // Tier 2: Moderate (Barcelona, Rome, Berlin, Dubai...)
  moderate:  { taxiPerKm: 2.0, transitFlat: 2.0 },
  // Tier 3: Budget (Bangkok, Lisbon, Istanbul, Mexico City...)
  budget:    { taxiPerKm: 0.8, transitFlat: 0.5 },
  default:   { taxiPerKm: 2.0, transitFlat: 2.0 },
}
```

Map ~40 major cities to tiers. Fall back to `default` for unlisted cities.

#### 4. Update `makeTransCard` to use coordinate-based estimates

Instead of hardcoded 15 min / $0:
- Look up coordinates from the preceding and following activities
- Call `estimateTransit()` with those coordinates and the resolved destination city
- Set `durationMinutes`, `endTime`, `cost.amount`, and `transportation.method` from the result
- Fallback to 15 min / $0 if either activity lacks coordinates

#### 5. Pass coordinates context to `repairBookends`

Pass `hotelCoordinates` and `resolvedDestination` (city name) so bookend transport cards (Return to Hotel, Travel to venue) also get accurate estimates.

#### 6. Update transit-estimate edge function pricing

Apply the same city-tier multiplier table to the `transit-estimate` edge function so frontend-expanded transit cards show city-aware costs too (currently uses flat `$2/km`).

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

#### 7. Pass `hotelCoordinates` into `repairDay()` call

Add `hotelCoordinates` from the enrichment context to the repair input.

**File: `supabase/functions/transit-estimate/index.ts`**

#### 8. Add city-tier pricing to frontend transit estimates

Accept optional `city` parameter in the request body. Apply city-tier multiplier to taxi and transit cost formulas instead of the flat $2/km.

### Expected results after fix

| Scenario | Before | After |
|---|---|---|
| Hotel restaurant (same building) | 15 min, $0 | Skipped (fuzzy match) |
| Venue 800m away | 15 min, $0 | 10 min walk, $0 |
| Venue 3km away | 15 min, $0 | 11 min transit, $2 (budget city) |
| Venue 12km away | 15 min, $0 | 33 min taxi, $10 (moderate city) |

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — haversine transit estimator, city-tier costs, coordinate-aware `makeTransCard`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — pass `hotelCoordinates` to repair
- `supabase/functions/transit-estimate/index.ts` — city-tier pricing for frontend estimates

