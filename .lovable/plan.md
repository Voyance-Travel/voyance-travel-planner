
## Completed: Hotel & Meal Logic Fixes

### What was done

1. **Broadened hotel detection** in `action-generate-day.ts` and `action-generate-trip-day.ts`
   - `hasHotel` now checks: flightContext.hotelName, paramHotelName, hotelOverride, hotelAddress, and existing accommodation activities
   - Repair pipeline always treats hotel as present (`hasHotel: true`) and uses "Your Hotel" placeholder when none is selected

2. **Added validate/repair pipeline to chain path** (`action-generate-trip-day.ts`)
   - Previously only ran light sanitization before save
   - Now runs the same full `validateDay()` + `repairDay()` pipeline as single-day path
   - Guarantees check-in, checkout, freshen-up, and return-to-hotel cards on every path

3. **Upgraded MEAL_DUPLICATE to repairable error** (`validate-day.ts`)
   - Was: `severity: 'warning', autoRepairable: false`
   - Now: `severity: 'error', autoRepairable: true`
   - Also detects non-adjacent duplicates (two dinners at different times)

4. **Added meal duplicate repair** (`repair-day.ts`)
   - Relabels wrongly-timed meals (dinner at 12:00 → lunch)
   - Swaps from restaurant pool if correct meal is missing
   - Removes unfixable duplicates

5. **Tightened final meal guard** (`day-validation.ts`)
   - `enforceRequiredMealsFinalGuard()` now deduplicates same-meal activities BEFORE injecting missing ones
   - Prevents "two dinners, no lunch" from passing as compliant

## Completed: Last Day / Checkout Repair Ordering

### What was done

1. **Reordered repair pipeline** in `repair-day.ts`
   - Check-in guarantee (step 7) and checkout guarantee (step 8) now run BEFORE bookend injection (step 9)
   - This ensures checkout exists before bookends try to inject conflicting hotel returns

2. **Added departure-day guards to `repairBookends`**
   - End-of-day "Return to Hotel" is skipped on departure days (last day or last day in city)
   - Mid-day freshen-up injection is skipped on departure days (traveler has checked out)
   - Mid-day freshen-up after hotel transport is skipped if it occurs after checkout

3. **Expected departure day sequence**: breakfast → checkout → (optional activity) → airport transport → security → flight
   - No more "Return to Hotel" after flights
   - No mid-day hotel returns after checkout
