
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
