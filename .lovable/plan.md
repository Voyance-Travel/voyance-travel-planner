

## Add Total Price Field to Hotel Edit + Sync to Budget

### Problem
When editing hotel details from the itinerary, there's no way to enter the total price. The form only has name, address, dates, and check-in/out times. Without a price field, the hotel cost never reaches the budget ledger.

### Changes

**1. `src/components/itinerary/AddBookingInline.tsx`**
- Add `totalPrice` (number, optional) to `ManualHotelEntry` interface
- Add a "Total Price" input field after the check-in/check-out time row (currency input, USD)
- Initialize from `existingHotel.totalPrice` when editing
- When saving, write `totalPrice` onto the `HotelBooking` object so it persists in `hotel_selection`
- After saving, call `syncHotelToLedger` to push the price into the budget ledger (import from `@/services/budgetLedgerSync`)

**2. `src/utils/hotelValidation.ts`**
- Add optional `totalPrice?: number` and `pricePerNight?: number` fields to `HotelBooking` interface (these are already expected by `syncHotelToLedger` but missing from the type)

**3. `src/components/itinerary/EditorialItinerary.tsx`**
- Pass existing hotel's `totalPrice` through the `existingHotel` prop so it pre-fills when editing

### Flow
User edits hotel → enters total price → save writes `totalPrice` to `hotel_selection` JSON → `syncHotelToLedger` upserts a committed ledger entry → budget tab reflects hotel cost.

