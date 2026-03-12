

## Fix: Remove 5 Bare `context.` References Crashing Schema Path

### Root Cause

The edge function error is:
```
ReferenceError: context is not defined
    at index.ts:8145
```

The schema path (`generate-day` handler, lines 6400-9800) does **not** have a `context` variable in scope — that object only exists in the old `generateDay()` function. Five references to `context.` were left in the schema path code, and any one of them crashes the entire day generation.

### The 5 References

| Line | Code | Fix |
|------|------|-----|
| 8224 | `context.multiCityDayMap?.[dayNumber - 1]` | Use `null` — transition hotel data already in `flightContext` |
| 8284 | `context.multiCityDayMap?.[dayNumber - 1]` | Use `null` — destination already resolved to `resolvedDestination` |
| 8286 | `context.firstTimePerCity?.[resolvedDestination]` | Use `effectiveIsFirstTimeVisitor` directly |
| 8821 | `context.multiCityDayMap?.[dayNumber - 1]` | Use `null` — hotel data already in `flightContext` |
| 9071 | `context?.budgetTier` | Use `effectiveBudgetTier` (already in scope) |

### Why Simple Replacements Work

The schema path already resolves multi-city data at lines 6431-6486 using `trip_cities` queries. The results are stored in local variables:
- `resolvedDestination` — the correct city for this day
- `resolvedCountry` — the country
- `resolvedIsTransitionDay`, `resolvedTransitionFrom/To` — transition data
- `flightContext.hotelName/hotelAddress` — hotel data
- `effectiveBudgetTier` — budget tier
- `effectiveIsFirstTimeVisitor` — visitor status

The `context.multiCityDayMap` lookups were redundant — they tried to re-fetch data that was already resolved into these local variables. Replacing with the locals (or `null` where the data feeds into optional blocks) is correct.

### Implementation

**File: `supabase/functions/generate-itinerary/index.ts`** — 5 line-level fixes:

1. **Line 8224**: Replace `context.multiCityDayMap?.[dayNumber - 1]` with `null` (the `destinationHotel` block already checks `resolvedIsTransitionDay` and can use `flightContext`)
2. **Line 8284**: Replace `context.multiCityDayMap?.[dayNumber - 1]` with `null` and refactor the block to use `resolvedDestination` directly
3. **Line 8286**: Replace `context.firstTimePerCity?.[resolvedDestination]` with `effectiveIsFirstTimeVisitor`
4. **Line 8821**: Replace `context.multiCityDayMap?.[dayNumber - 1]` with `null` and use `flightContext` for hotel data
5. **Line 9071**: Replace `context?.budgetTier` with `effectiveBudgetTier`

For the multi-city context block (lines 8282-8293), simplify to use `resolvedDestination`/`resolvedCountry`/`effectiveIsFirstTimeVisitor` directly since these were already computed from `trip_cities`.

For the hotel address correction (Gap 2, line 8821), use `flightContext?.hotelName` and `flightContext?.hotelAddress` directly instead of going through `multiCityDayMap`.

