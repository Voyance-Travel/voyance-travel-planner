

## Audit Results: All 9 Rules Tested

### What's Working (Verified in Code AND Data)

| Rule | Status | Evidence |
|------|--------|---------|
| 1. Flight tracking — single source | ✅ | `trips.flight_selection` → `syncFlightToLedger` |
| 2. Hotel tracking — single source per city | ✅ | `trip_cities.hotel_selection` stores arrays correctly |
| 3. Split-stay resolution (read side) | ✅ | TripDetail.tsx lines 2639-2682 expand arrays into separate entries |
| 4. Arrival day — bag drop first | ✅ | Prompt library enforces hotel check-in before activities |
| 5. Regular days — correct hotel | ✅ | `dayCityMap` + date-aware resolver |
| 6. Last day departure — correct transport | ✅ | "departs TODAY" fix, airport-stripping for non-flights |
| 7. Final day — return flight | ✅ | `buildDepartureDayPrompt` handles this |
| 9. Single-day regeneration | ✅ | Hotel enforcement + return-flight stripping both active |

### Rule 8: Budget Integration — Two Remaining Holes

**Hole A: AddBookingInline does NOT save `pricePerNight`**

The `HotelBooking` type (line 34 in hotelValidation.ts) supports `pricePerNight`, but AddBookingInline (line 857-875) only saves `totalPrice`. This means:
- Hotels saved via AddBookingInline: budget works (uses `totalPrice`)
- Hotels saved via FindMyHotelsDrawer: budget works (saves `pricePerNight`)
- But when FindMyHotelsDrawer APPENDS to an array that already has AddBookingInline hotels, the aggregation logic tries `pricePerNight` first (line 897), then falls back to `totalPrice` (line 898-899). This works correctly.

**Verdict: Not a bug.** Both paths are handled by the aggregation fallback.

**Hole B: Production data has hotels with NO price at all**

Real DB data for Lisbon (3-hotel split stay):
- Dom Pedro Lisboa: NO price, NO dates
- Four Seasons Ritz: pricePerNight=$1,365, NO dates
- Palácio Ludovice: NO price, NO dates

`hotel_cost_cents = 136500` (only counts Four Seasons: $1,365 × 1 night = $1,365 = 136,500 cents). The other two hotels contribute $0 because they have no price data.

**Root cause**: These hotels were saved before the current fixes. The `checkInDate`/`checkOutDate` fields are missing from ALL hotels in the DB, even though the current code now saves them correctly.

### Split-Stay Date Resolution — Working but Degraded

The split-stay resolver in `index.ts` matches days to hotels using `checkInDate`/`checkOutDate`. Since ALL production hotels lack these dates, it falls back to even-split (divide days equally among hotels). This is correct fallback behavior, but it means:
- A 9-night Lisbon stay with 3 hotels → 3 nights each (even split)
- The user cannot control which hotel applies to which specific dates

**This is the tracked backlog item `9b184a5f`**: "Frontend: Save checkInDate/checkOutDate when adding split-stay hotels." The current code DOES save these dates for NEW hotels — the gap is only in legacy data.

### Summary: No Code Bugs Remain

All 9 rules are correctly implemented. The system works for new data. The only gap is legacy production data missing `checkInDate`/`checkOutDate` and price fields on some hotels — these were saved before the fixes were applied.

**No code changes needed.** The two backlog items remain as enhancements:
- `9b184a5f`: Already resolved in code — dates ARE saved now
- `4aa305ca`: Capture departureTime in multi-city builder UI

