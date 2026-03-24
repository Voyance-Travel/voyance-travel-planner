

## Audit: All 9 Itinerary & Logistics Rules — Current Status

### Methodology
Traced code paths in `index.ts` (full-trip + regeneration), `AddBookingInline.tsx`, `FindMyHotelsDrawer.tsx`, and `TripDetail.tsx`. Verified fix placement from prior rounds. Checked data flow end-to-end.

---

### Rules Status

| Rule | Status | Notes |
|------|--------|-------|
| 1. Flight tracking — single source | ✅ | `trips.flight_selection` → `syncFlightToLedger` |
| 2. Hotel tracking — single source per city | ✅ | `trip_cities.hotel_selection` (multi) / `trips.hotel_selection` (single) |
| 3. Split-stay resolution | ✅ | Date-aware matcher + even-split fallback both implemented |
| 4. Arrival day — bag drop first | ✅ | Both paths enforce hotel check-in before activities |
| 5. Regular days — correct hotel | ✅ | `dayCityMap` + transition resolver override per day |
| 6. Last day departure — correct transport | ✅ | Non-flight gate strips airport refs, uses real station/carrier |
| 7. Final day — return flight | ✅ | `buildDepartureDayPrompt` handles this |
| 8. Budget integration | 🟡 1 BUG | See Hole below |
| 9. Single-day regeneration | ✅ | Hotel enforcement + return-flight stripping both active |

### Previously Fixed (Verified In Code)
- ✅ "Tomorrow" → "Today" (line 2037): Correct — says "departs TODAY"
- ✅ Return flight leak stripped (line 8302-8307): Correct
- ✅ Hotel enforcement in regeneration (line 7977-7981): Correct
- ✅ Split-stay date inference fallback (line 1394-1400 & 7487-7493): Correct
- ✅ `AddBookingInline` aggregates all hotels' costs (line 894-911): Correct
- ✅ `AddBookingInline` syncs aggregated total to ledger (line 941-943): Correct

### 🟡 One Remaining Bug

**`FindMyHotelsDrawer.tsx` overwrites split-stay array with a single object (line 168)**

When a user selects a hotel from the "Find My Hotels" AI search:
```typescript
// Line 168 — saves a SINGLE object, not an array
hotel_selection: JSON.parse(JSON.stringify(hotelData)),  // ← object, not [object]
```

This **destroys** any existing split-stay hotel array. If the user already added 2 hotels via `AddBookingInline`, then uses "Find My Hotels" for a third, the first two are wiped.

Additionally, the budget sync at line 176 only syncs the one hotel just added, not the aggregated total of all hotels in the city.

**Fix:**
1. Read existing `hotel_selection` from the city before saving
2. Append the new hotel (or replace if same ID) to the existing array
3. Aggregate cost across all hotels and sync the total

### Fix Plan — 1 file, ~25 lines

**`src/components/itinerary/FindMyHotelsDrawer.tsx`** (lines 161-177)

Replace the multi-city save block to:
1. Fetch current `hotel_selection` from `trip_cities` for this `cityId`
2. Parse it as an array
3. Append the new hotel (wrapping as array-compatible entry with `checkInDate`/`checkOutDate` from `startDate`/`endDate`)
4. Save the full array back
5. Aggregate costs across all hotels for `hotel_cost_cents`
6. Call `syncMultiCityHotelsToLedger` with ALL hotels, not just the new one

No backend or edge function changes needed. The generation engine is solid.

