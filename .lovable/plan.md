

## Fix: Hotel Pricing Confusion + Missing Hotels in Itinerary

### Problem 1: Price field confusion (biggest issue)
In `Start.tsx`, the hotel price input label says **"Hotel Total Price"** (line 2019) but stores the value in `pricePerNight`. Downstream, `syncHotelToLedger` and `EditorialItinerary` treat `pricePerNight` as a per-night rate and **multiply it by nights**, causing wildly inflated trip costs.

The field name `pricePerNight` is used throughout the codebase, so the safest fix is to:
- Rename the label to **"Price Per Night"** (what the system expects)
- Add helper text: "Enter the nightly rate — we'll calculate the total"
- Fix the display in Start.tsx from `${hotel.pricePerNight} total` to `${hotel.pricePerNight}/night`

### Problem 2: Only first hotel shown in itinerary (single-city trips)
For single-city trips with multiple hotels (split stays), `TripDetail.tsx` passes only `primaryHotelSelection = allNormalizedHotels[0]` to `EditorialItinerary`. The itinerary view then renders a single hotel card. The remaining hotels are saved in the database but invisible.

Fix: When `allNormalizedHotels.length > 1` on a single-city trip, build a `CityHotelInfo[]` array (one entry per hotel with its check-in/check-out dates) and pass it as `allHotels` — the same pattern used for multi-city. This makes the multi-hotel rendering path handle split stays too.

### Problem 3: Budget sync uses wrong price for multi-hotel
`syncHotelToLedger` only syncs a single hotel's cost. For split stays, it should sum all hotels' costs.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/Start.tsx` | Change label from "Hotel Total Price" → "Price Per Night (USD)". Add helper text. Fix display from `${h.pricePerNight} total` → `${h.pricePerNight}/night`. |
| 2 | `src/pages/TripDetail.tsx` | When `allNormalizedHotels.length > 1` on a single-city trip, build `cityHotels` array from the normalized hotels (each with its own check-in/check-out dates) and pass as `allHotels`. |
| 3 | `src/components/itinerary/EditorialItinerary.tsx` | In the single-hotel accommodation section (line ~6259), display `pricePerNight` with "/night" label consistently. |
| 4 | `src/components/itinerary/AddBookingInline.tsx` | The "Total Price (USD)" field here is correctly labeled as total — no change needed, but verify the value flows correctly. |

