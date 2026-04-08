

# Fix Transit Time Calculation & Labels

## Problem
Transit estimates in `repair-day.ts` use raw haversine (straight-line) distance, producing unrealistically short walking times. The walking threshold is too generous, transit labels get stale after reordering, and missing coordinates cause transit cards to be skipped entirely.

## Changes

### 1. Add city walking factor & lower walk threshold in `estimateTransit()`
**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (~line 336-367)

- Add `CITY_WALK_FACTOR = 1.4` constant — multiplies haversine distance to approximate real street-level routing
- Lower the walking threshold from `1200m` to `800m` haversine (≈1.1km actual, ≈14 min walk)
- Apply `adjustedDist = dist * CITY_WALK_FACTOR` in walking and transit duration calculations
- Taxi calculation stays on raw distance (road routing is closer to straight-line at scale)

```typescript
const CITY_WALK_FACTOR = 1.4;
const adjustedDist = dist * CITY_WALK_FACTOR;
const MAX_COMFORTABLE_WALK_METERS = 800;

if (dist <= MAX_COMFORTABLE_WALK_METERS) {
  const dur = Math.max(3, Math.ceil(adjustedDist / 80));
  result = { durationMinutes: dur, method: 'walking', ... };
} else if (dist <= 8000) {
  const dur = Math.max(8, Math.ceil(adjustedDist / 500) + 5);
  result = { durationMinutes: dur, method: 'transit', ... };
} else {
  // Taxi unchanged (uses raw dist)
}
```

### 2. Add missing-coordinate fallback for transit injection
**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

- Add `getDefaultTransitMinutes()` helper with postal-code and same-venue awareness
- Add `extractPostalCode()` helper
- In `makeTransCard()` (~line 910) and the gap-injection loop (~line 3211), use the fallback when coords are missing instead of defaulting to a hardcoded 15 min or skipping
- Log fallback usage with `[TRANSIT-FALLBACK]`

### 3. Add transit label regeneration helper
**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

- Add `generateTransitLabel(nextActivity, mode)` helper that picks the destination name from `location.name`, `venue_name`, or `title`
- Use mode-specific labels: "Walk to X", "Travel to X", "Taxi to X"
- Apply this helper in all existing label-generation sites (makeTransCard, rewrite blocks at ~lines 2588, 3158, 3250, 3328) for consistency
- No behavioral change — just centralizes label logic and ensures mode-aware labels

### 4. Add AI transit estimation guidance to prompt
**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (~line 1261)

- Add items 11-12 to CRITICAL REMINDERS:
  - Transit reality check (different neighborhoods = 10-15 min minimum)
  - Transit label must name the actual next venue
- Add a TRANSIT TIME ESTIMATION GUIDE block near the existing transit instructions (~line 863) with distance-based minimums

### 5. Deploy
- Deploy `generate-itinerary` edge function

## What's NOT changed
- Taxi calculations (reasonable as-is)
- Inter-city transit logic
- Activity generation or reordering logic
- Database schema or API contracts
- Google Maps/Places API calls

