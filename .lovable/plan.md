

## The Real Bug: TripDetail.tsx Discards Split-Stay Hotels

### What's Actually Broken

All the save-side fixes (AddBookingInline, FindMyHotelsDrawer) are correct. They properly save arrays and aggregate costs. But the **read-side** in `TripDetail.tsx` destroys the data before it reaches the UI.

**Line 2639 in TripDetail.tsx:**
```typescript
const hotelData = Array.isArray(hotelRaw) && hotelRaw.length > 0 ? hotelRaw[0] : hotelRaw;
```

This takes only the FIRST hotel from a split-stay array. So when a city has 3 hotels (e.g., Lisbon with Four Seasons → Bairro Alto → Alfama), only "Four Seasons" reaches `EditorialItinerary`.

### Impact on Each Rule

| Rule | Impact |
|------|--------|
| 3. Split-stay resolution | **BROKEN** — only first hotel visible in UI |
| 5. Regular days — correct hotel | **BROKEN** — days assigned to 2nd/3rd hotel show wrong hotel |
| 8. Budget display | **PARTIALLY BROKEN** — header total only counts first hotel per city (ledger sync from AddBookingInline is correct, so the Payments tab may show the right number, but the JS-calculated `hotelCost` on line 2999 is wrong) |

### The Fix

**File: `src/pages/TripDetail.tsx`** (~30 lines changed)

Currently `CityHotelInfo` has a single `hotel?: HotelSelection` field. For split-stay support, we need to either:

**Option A (Minimal — recommended):** When building `cityHotels`, expand split-stay arrays into separate `CityHotelInfo` entries — one per hotel with its own `checkInDate`/`checkOutDate`. This is what the single-city split-stay path already does (lines 2603-2625). The multi-city path should do the same.

Concretely, replace lines 2636-2672 to:
1. For each `tripCity`, check if `hotel_selection` is an array with multiple entries
2. If so, create one `CityHotelInfo` per hotel in the array, each with its own dates, inheriting the city's `cityName`, `cityId`, and transport info (only on the last entry)
3. If single hotel, keep current behavior

This way `allHotels` correctly has N entries for N hotels across all cities, and:
- Budget calculation (line 2999) sums all of them
- Budget ledger sync (line 1465) syncs all of them  
- Hotel injection resolves the correct hotel per day
- The Arrival Game Plan shows the right hotel

### What's Already Working (No Changes Needed)

- **Rules 1, 4, 6, 7, 9**: Generation engine is solid
- **AddBookingInline**: Correctly saves arrays, aggregates costs, syncs ledger
- **FindMyHotelsDrawer**: Correctly appends to arrays, aggregates, syncs
- **budgetLedgerSync.ts**: `syncMultiCityHotelsToLedger` works correctly
- **`hotel_cost_cents` on `trip_cities`**: Correctly aggregated at save time

### Summary

One bug in one file. The save path is correct. The read path discards split-stay data. Fix `TripDetail.tsx` lines 2636-2672 to expand split-stay arrays into separate `CityHotelInfo` entries.

