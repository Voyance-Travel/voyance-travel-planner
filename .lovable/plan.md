

## Hotel & Flight Integration Audit: Pre-Generation + Post-Generation Paths

### All Save Paths Inventoried

| # | Path | Component | When | Budget Sync | Itinerary Patch | Transport Cascade | `booking-changed` Event |
|---|------|-----------|------|-------------|-----------------|-------------------|------------------------|
| 1 | **Pre-gen flight** | `Start.tsx` form | Before generation | ❌ None | N/A (no itinerary yet) | N/A | N/A |
| 2 | **Pre-gen hotel** | `Start.tsx` form | Before generation | ❌ None | N/A (no itinerary yet) | N/A | N/A |
| 3 | **Post-gen flight (inline)** | `AddBookingInline.tsx` | After generation | ❌ **MISSING** | ❌ **MISSING** | ✅ `runCascadeAndPersist` | ✅ |
| 4 | **Post-gen hotel (inline)** | `AddBookingInline.tsx` | After generation | ✅ `syncHotelToLedger` | ✅ `patchItineraryWithHotel` | N/A | ✅ |
| 5 | **Post-gen hotel (FindMyHotels)** | `FindMyHotelsDrawer.tsx` | After generation | ✅ `syncHotelToLedger` | ❌ **MISSING** | N/A | ❌ **MISSING** |
| 6 | **Post-gen flight (useSaveFlight)** | `trips.ts` mutation | After generation | ✅ `syncFlightToLedger` | ❌ **MISSING** | ❌ **MISSING** | ❌ **MISSING** |
| 7 | **Post-gen hotel (useSaveHotel)** | `trips.ts` mutation | After generation | ✅ `syncHotelToLedger` | ❌ **MISSING** | N/A | ❌ **MISSING** |
| 8 | **Initial load sync** | `EditorialItinerary.tsx` | Page load | ✅ Both synced | N/A | N/A | N/A |

### Pre-Generation (Verified Working)

Both flight and hotel are stored to `trips.flight_selection` / `trips.hotel_selection` (or `trip_cities.hotel_selection`) before generation. The `generate-itinerary` edge function reads them via `getFlightHotelContext()` — this is correct and consistent. No budget sync needed pre-gen because there's no itinerary yet, and the EditorialItinerary initial-load sync (Path 8) catches up on first render.

**Pre-gen is clean. No gaps.**

---

### Gaps Found

#### GAP 1: AddBookingInline Flight Save — Missing Budget Sync + Itinerary Patch (HIGH)

When a user adds/edits a flight via `AddBookingInline.tsx` (the primary post-gen flow), the code:
- ✅ Saves `flight_selection` to DB
- ✅ Runs `runCascadeAndPersist` (transport cascade)
- ✅ Dispatches `booking-changed`
- ❌ **Never calls `syncFlightToLedger`** — flight price not written to `activity_costs`
- ❌ **Never calls `patchItineraryWithFlight`** — Day 1/last day arrival/departure activities not adjusted

The `patchItineraryWithFlight` function exists and is fully implemented but is imported by nobody. It's dead code.

**Impact**: Flight costs don't appear in Expected Spend or Budget until the user navigates away and back (EditorialItinerary initial-load sync catches it). Day 1 activities may start before the flight lands.

**Fix**: Add `syncFlightToLedger` and `patchItineraryWithFlight` calls after the flight save in `AddBookingInline.tsx`.

---

#### GAP 2: FindMyHotelsDrawer — Missing Itinerary Patch + booking-changed Event (MEDIUM)

When a user picks a hotel via FindMyHotelsDrawer:
- ✅ Saves hotel to DB
- ✅ Syncs to budget via `syncHotelToLedger`
- ❌ **Never calls `patchItineraryWithHotel`** — itinerary still shows "Hotel Check-in & Refresh" instead of the hotel name
- ❌ **Never dispatches `booking-changed`** — financial snapshot doesn't refresh

**Impact**: Itinerary accommodation activities show generic names. Budget tab doesn't update until manual refresh.

**Fix**: Add `patchItineraryWithHotel` and `booking-changed` event dispatch.

---

#### GAP 3: `useSaveFlightSelection` / `useSaveHotelSelection` Hooks — Missing Itinerary Patch + Cascade + Event (MEDIUM)

The React Query mutation hooks in `trips.ts` are used by some components. They call the budget sync but:
- ❌ No `patchItineraryWithFlight` / `patchItineraryWithHotel`
- ❌ No `runCascadeAndPersist` for flights
- ❌ No `booking-changed` event dispatch

**Impact**: Any component using these hooks (rather than AddBookingInline directly) gets budget sync but misses itinerary updates and financial snapshot refresh.

**Fix**: Add the missing calls to both mutation hooks in `trips.ts`.

---

### Summary — Priority Order

1. **AddBookingInline flight: add `syncFlightToLedger` + `patchItineraryWithFlight`** — Primary post-gen flight path missing both budget and schedule sync
2. **FindMyHotelsDrawer: add `patchItineraryWithHotel` + `booking-changed`** — Hotel names not cascading to itinerary
3. **`useSaveFlightSelection`: add `patchItineraryWithFlight` + cascade + event** — Mutation hook missing schedule sync
4. **`useSaveHotelSelection`: add `patchItineraryWithHotel` + event** — Mutation hook missing itinerary patch

### Files to Edit

| Fix | File |
|-----|------|
| GAP 1 | `src/components/itinerary/AddBookingInline.tsx` (line ~286-320) |
| GAP 2 | `src/components/itinerary/FindMyHotelsDrawer.tsx` (line ~176-184) |
| GAP 3 | `src/services/supabase/trips.ts` (`useSaveFlightSelection` + `useSaveHotelSelection`) |

