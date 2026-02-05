
# Plan: Harden Itinerary Data Parsing

## ✅ COMPLETED

This plan has been fully implemented.

---

## Summary of Changes

### 1. Created `src/utils/itineraryParser.ts` (NEW)
Centralized safe parser with:
- **Null filtering**: Filters out `null`/`undefined` entries before mapping
- **Stable IDs**: Uses deterministic IDs (`day${dayIdx+1}-act${actIdx}`) instead of `Math.random()`
- **Field normalization**: Handles both camelCase and snake_case variants
- **Type-safe extraction**: Helper functions for strings, numbers, booleans
- **Multiple output formats**: `parseActiveTripDays()`, `parseEditorialDays()`, `parseAssistantDays()`
- **Never throws**: Returns empty arrays/safe defaults on malformed data

### 2. Updated `src/pages/ActiveTrip.tsx`
- Replaced inline parsing with `parseActiveTripDays(trip.itinerary_data, trip.start_date)`
- Removed `Math.random()` ID generation
- Added import for parser utility

### 3. Updated `src/pages/TripDetail.tsx`
- Replaced inline parsing in EditorialItinerary section with `parseEditorialDays()`
- Replaced inline parsing in ItineraryAssistant section with `parseAssistantDays()`
- Added imports for parser utilities

### 4. Updated `src/utils/typeGuards.ts`
- Added `isValidItineraryData()` type guard

---

## Benefits Achieved

1. ✅ **No more crashes** from null/undefined in arrays
2. ✅ **Stable React keys** - no `Math.random()` causing re-renders
3. ✅ **Single source of truth** - one parser to fix/update
4. ✅ **Better debugging** - console warnings for malformed data
5. ✅ **Type safety** - properly typed output with defaults
