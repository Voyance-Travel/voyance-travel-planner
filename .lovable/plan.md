
# Fix #10 and #15: Update Stale Comments

Two comment-only changes across two files. Zero logic changes.

## Change 1: `src/lib/tripCostCalculator.ts` (line 3)

**Before:**
```
// Formula: roundUpTo10((Days x 90 + MultiCityFee) x TierMultiplier) + AddOns
```

**After:**
```
// Formula: roundUpTo10((Days x BASE_RATE_PER_DAY + MultiCityFee) x TierMultiplier) + AddOns
// Current BASE_RATE_PER_DAY = 60 (see CONSTANTS section below)
```

## Change 2: `src/config/pricing.ts` (lines 8-9)

**Before:**
```
  // Dynamic (variable cost, calculated at generation time)
  TRIP_GENERATION: 0,         // Placeholder: use tripCostCalculator for actual cost
```

**After:**
```
  // GUARD: TRIP_GENERATION is a PLACEHOLDER. Actual cost is calculated dynamically
  // by tripCostCalculator.calculateTripCredits(). Do NOT read this value for display.
  // Use voyanceFlowController re-export of calculateTripCredits() instead.
  TRIP_GENERATION: 0,  // Placeholder only - see guard comment above
```

## What does NOT change
- No logic changes anywhere
- No other files touched
- Purely documentation improvements
