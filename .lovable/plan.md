

## Hotel → Itinerary Integration: Audit & Fix Plan

### Current State

**What works:**
- **Backend generation** correctly handles multi-hotel/split-stay: `generation-core.ts` detects `isHotelChange` between consecutive hotels in the same city, prompts the AI with `📍 HOTEL CHANGE` instructions for checkout + check-in on the transition day
- **Frontend injection** (`injectHotelActivities.ts`): has `injectMultiHotelActivities()` that strips old hotel cards and re-injects check-in/checkout per hotel using date matching
- **TripDetail.tsx**: correctly builds `CityHotelInfo[]` from `trip_cities` and calls `injectMultiHotelActivities` when hotel data changes
- **Step 2 (Start.tsx)**: supports split-stay entry with dates per hotel

**What's broken:**

1. **`patchItineraryWithHotel` is date-blind** — When a hotel is saved (from Step 2, Planner, FindMyHotels, or AddBookingInline), `patchItineraryWithHotel` replaces ALL accommodation activities across ALL days with one hotel's name. For multi-hotel trips, saving Hotel B overwrites Hotel A's cards too. The function accepts `checkInDate`/`checkOutDate` but never uses them.

2. **Post-generation hotel add doesn't inject transition-day cards** — `injectMultiHotelActivities` handles check-in and checkout per hotel, but when a second hotel is added after generation, it doesn't inject a "drop bags at new hotel" activity at noon on the transition day. It only places check-in at 3 PM and checkout at 11 AM.

3. **PlannerHotelEnhanced saves don't pass dates to patch** — Lines 553-556 and 574-577 call `patchItineraryWithHotel` without `checkInDate`/`checkOutDate`, so even if the patch function were date-aware, it wouldn't know which days to scope to.

4. **AddBookingInline & FindMyHotelsDrawer also patch blindly** — Same issue: they call `patchItineraryWithHotel` with just `name` and `address`.

### Plan

#### 1. Make `patchItineraryWithHotel` date-aware

**File: `src/services/hotelItineraryPatch.ts`**

- When `checkInDate` and `checkOutDate` are provided, only patch accommodation activities on days within that date range
- When dates are absent (backward compat), patch all days as before
- Add a new export `patchItineraryWithMultipleHotels(tripId, hotels[])` that scopes each hotel's patches to its date range

#### 2. Add transition-day logic to `injectMultiHotelActivities`

**File: `src/utils/injectHotelActivities.ts`**

- After injecting all check-in/checkout cards, detect transition days: days where Hotel A checks out AND Hotel B checks in
- On those days, insert a "Drop bags at [Hotel B]" card at 12:00 (after 11:00 checkout, before 3:00 PM check-in), with category `accommodation`, 30-min duration
- Adjust check-in card on transition days: keep it at 3:00 PM but add note "Bags already dropped off"

#### 3. Pass dates from all save paths

**Files:**
- `src/pages/planner/PlannerHotelEnhanced.tsx` — pass `checkInDate`/`checkOutDate` to `patchItineraryWithHotel`
- `src/components/itinerary/AddBookingInline.tsx` — same
- `src/components/itinerary/FindMyHotelsDrawer.tsx` — same
- `src/services/supabase/trips.ts` — same

For multi-hotel saves, call the new `patchItineraryWithMultipleHotels` instead.

#### 4. Re-inject hotel cards after any hotel save (booking-changed listener)

**File: `src/pages/TripDetail.tsx`** (booking-changed handler, ~line 3010)

This already works — on `booking-changed`, it re-fetches trip + cities, parses days, and runs `injectMultiHotelActivities`. Verify it also calls the date-aware patch so titles are correct.

### Technical Details

```text
Transition day timeline (Hotel A → Hotel B):

  11:00  Checkout from Hotel A
  12:00  Drop bags at Hotel B (new card)
  12:30  Free for activities
  15:00  Check-in at Hotel B

patchItineraryWithHotel date scoping:

  For each day in itinerary_data.days:
    dayDate = day.date (YYYY-MM-DD)
    if hotel.checkInDate && hotel.checkOutDate:
      skip if dayDate < checkInDate or dayDate > checkOutDate
    patch accommodation activities on this day only
```

### Expected Result
- Step 2: user enters 2 hotels with dates → generation already handles it (HOTEL CHANGE prompt). After generation, cards show correct hotel names per day.
- Post-generation hotel add: user adds Hotel B via booking.com or manual entry → injection places checkout/drop-bags/check-in on transition day, patches only the relevant days' accommodation cards with Hotel B's name.
- Single hotel: behavior unchanged — all accommodation cards get that hotel's name.

