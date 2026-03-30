

# Fix: Consistent "Your Hotel" Placeholder Across All Paths

## Problem

The recent changes correctly use `"Your Hotel"` in the morning arrival, afternoon arrival, Day 1 no-flight, and last-day no-flight paths. But several other paths still use inconsistent fallbacks:

1. **Line 54**: `hotelNameDisplay = flightContext.hotelName || ''` — empty string fallback means evening arrival (line 257) renders `location: { name: "", address: "" }` when no hotel is selected
2. **Line 348**: Transport departure path uses `flightContext.hotelName || 'Hotel'` — should be `'Your Hotel'`
3. **Line 425**: Flight departure path uses `flightContext.hotelName || ''` — empty string again
4. **Lines 684, 696**: Late-departure no-flight path uses `flightContext.hotelName || 'hotel'` and `'Hotel'` — should be `'Your Hotel'`
5. **Evening arrival (lines 242-270)**: Has no `hasHotelData` branch at all — always uses `hotelNameDisplay` which could be empty

## Changes

### `compile-day-schema.ts` — 3 targeted fixes

1. **Line 54**: Change `flightContext.hotelName || ''` to `flightContext.hotelName || 'Your Hotel'`  
   This fixes the evening arrival path and all other paths that share this variable.

2. **Line 348**: Change `flightContext.hotelName || 'Hotel'` to `flightContext.hotelName || 'Your Hotel'`

3. **Line 425**: Change `flightContext.hotelName || ''` to `flightContext.hotelName || 'Your Hotel'`

4. **Lines 684, 696**: Change `flightContext.hotelName || 'hotel'` to `flightContext.hotelName || 'Your Hotel'` and `flightContext.hotelName || 'Hotel'` to `flightContext.hotelName || 'Your Hotel'`

These are single-line string fixes. No logic changes needed — the placeholder is already handled downstream by `patchItineraryWithHotel` and `repair-day.ts`.

### Expected result

Every single path in the schema compiler outputs `"Your Hotel"` when no hotel is selected — morning, afternoon, evening arrivals, transport departures, flight departures, and late-departure days. One consistent name, one consistent patching target.

