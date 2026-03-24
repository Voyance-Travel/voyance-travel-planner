

## End-to-End Audit: Itinerary & Logistics Rules

### Test Results

**Smoke tests**: 59/60 pass. 1 pre-existing meal-policy test failure (unrelated to logistics rules).

**Real data examined**: Morocco→Casablanca→Lisbon trip (`d987abcd`), two Italy trips (Rome→Florence→Venice), plus 7 single-city trips with hotel/flight data.

---

### Rule-by-Rule Status

| Rule | Status | Evidence |
|------|--------|----------|
| **1. Flight — single source** | ✅ WORKS | `trips.flight_selection` is the sole location. `syncFlightToLedger` syncs to `activity_costs`. Verified: Marrakech trip has hotel ledger row (`$11,750`). |
| **2. Hotel — single source per city** | ✅ WORKS | Multi-city uses `trip_cities.hotel_selection`. Single-city uses `trips.hotel_selection`. Morocco trip: all 3 cities have per-city hotel arrays with full `checkInDate`/`checkOutDate`. |
| **3. Split-stay resolution** | ✅ WORKS (for this trip) | Marrakech has 2 hotels (Mandarin Oriental → Radisson Blu) with proper dates. Lisbon has 3 hotels with proper dates. The date-aware matcher will resolve correctly. |
| **4. Arrival day — bag drop** | ✅ WORKS | `buildArrivalDayPrompt` + multi-city overlay both enforce hotel-first. |
| **5. Regular days — correct hotel** | ✅ WORKS | `dayCityMap` overrides per day in full-trip. Transition resolver handles regeneration. |
| **6. Last day departure** | ✅ WORKS (with fixes applied) | "Today" language fix applied. Non-flight gate strips airport refs. Transport details from `trip_cities.transport_details` include station, operator, duration. |
| **7. Final day — return flight** | ✅ WORKS | `buildDepartureDayPrompt` handles this. |
| **8. Budget integration** | 🔴 BROKEN | See Hole 1 below. |
| **9. Single-day regeneration** | ✅ WORKS | Transition resolver loads `hotel_selection`, resolves per-city hotel, applies hotel enforcement prompt. |

---

### 🔴 Remaining Holes

**Hole 1: Multi-city hotel costs NOT syncing to budget (CRITICAL)**

Real data proof: Trip `d987abcd` (Marrakech→Casablanca→Lisbon) has hotels in all 3 cities with prices:
- Marrakech: Mandarin Oriental ($2,350/night), Radisson Blu (no price)  
- Casablanca: Hyatt Regency (no price)
- Lisbon: Four Seasons Ritz ($1,365/night), others no price

BUT:
- `activity_costs` for this trip: **empty** (0 rows with `day_number=0`)
- `trip_cities.hotel_cost_cents`: **all 0** for all 3 cities

**Root cause**: Two separate bugs:
1. **`AddBookingInline.tsx` line 900**: When adding a hotel to a city, it sets `hotel_cost_cents = pricePerNight * 100` (just ONE night), not the total stay cost. For split-stays, it doesn't aggregate.
2. **Budget ledger sync only triggers on itinerary view** (`EditorialItinerary.tsx` line 1458). If the user adds hotels but never views the itinerary, the ledger never syncs. The Morocco trip has `itinerary_status: not_started` for the parent — the user added hotels but hasn't generated yet, so no sync happened.

**Fix needed**:
- `AddBookingInline.tsx`: Calculate `hotel_cost_cents = pricePerNight * nights` (not just 1 night)
- `PlannerHotelEnhanced.tsx`: Already does this correctly (line 537) — no change needed
- `FindMyHotelsDrawer.tsx`: Uses `totalPrice || pricePerNight` (line 168) — should use `pricePerNight * nights`
- Add sync trigger when hotel is saved (not just on itinerary view)

**Hole 2: `hotel_cost_cents` on `trip_cities` never aggregates split-stay totals**

When a city has 2+ hotels, each `update()` call overwrites `hotel_cost_cents` with just the latest hotel's cost. The column should hold the SUM of all hotels in that city.

**Fix**: After saving a hotel to `hotel_selection` array, recalculate `hotel_cost_cents` as the sum of all hotels' `pricePerNight * nights`.

**Hole 3: No `departureTime` in transport_details (confirmed by ALL real data)**

All 5 transport legs across 3 trips have `departureStation`, `operator`, `duration` but NO `departureTime`. The 10:30 AM default is always used. Already tracked as task `4aa305ca`.

**Hole 4: Pre-existing meal policy test failure**

`validateGeneratedDay fails when required meal policy is not met` — the test expects `true` but gets `false`. This suggests the validation function may have been refactored to be more lenient. Low priority but should be fixed to keep CI green.

---

### What's NOT Broken (Competing Rules Resolved)

1. **"Tomorrow" vs "Today"** — Fixed. Full-trip path now says "departs TODAY".
2. **Return flight leak on non-flight days** — Fixed. Stripped in regeneration path.
3. **Hotel enforcement in regeneration** — Fixed. `🚫 CRITICAL` block injected.
4. **Split-stay date inference** — Fixed. Even distribution fallback works when dates are missing.
5. **`isLastDayInCity` vs `isLastDay` collision** — Correctly handled in both paths.

---

### Proposed Fixes (3 files, ~15 lines total)

**File 1: `src/components/itinerary/AddBookingInline.tsx`** (line ~898-902)
- Calculate total cost as `pricePerNight * nights` instead of just `pricePerNight`
- After saving, recalculate `hotel_cost_cents` as sum of all hotels in the city's `hotel_selection` array

**File 2: `src/components/itinerary/FindMyHotelsDrawer.tsx`** (line ~166-170)
- Same fix: use `pricePerNight * nights` for `hotel_cost_cents`

**File 3: `src/components/itinerary/AddBookingInline.tsx` or parent**
- Trigger `syncMultiCityHotelsToLedger` after hotel save (not just on itinerary view)

**No backend changes needed** — the generation engine and prompt logic are solid.

