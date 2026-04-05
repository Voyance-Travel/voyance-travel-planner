

## Fix: Breakfast at Wrong Hotel on Hotel-Change Days

### Problem
On hotel-change days (split-stay), breakfast is generated for the NEW hotel before checkout, but the traveler is still at the OLD hotel. The correct sequence is: Breakfast at old hotel → Checkout → Travel → Check-in at new hotel.

### Root Cause
The prompt compiler (`compile-prompt.ts`) uses `flightContext.hotelName` (the NEW hotel) for the breakfast instruction. It never checks `resolvedIsHotelChange` or `resolvedPreviousHotelName`, even though both are already computed in `compile-day-facts.ts` and available in `CompiledFacts`.

The repair pipeline (`repair-day.ts` lines 1411-1469) tries to fix pre-checkout dining references but only catches titles that explicitly mention the new hotel name or "your hotel". If the AI generates "Breakfast at [restaurant name]" with the new hotel's location, the repair misses it.

### Changes

**1. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** — Use previous hotel for breakfast on hotel-change days

- Destructure `resolvedIsHotelChange` and `resolvedPreviousHotelName` from `facts`
- On hotel-change days, override the breakfast hotel name to use `previousHotelName` instead of `flightContext.hotelName`
- Add an explicit instruction: "You are still at [PREVIOUS HOTEL] in the morning. Breakfast must be at [PREVIOUS HOTEL] or nearby — NOT at [NEW HOTEL], which you haven't checked into yet."

**2. `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Strengthen pre-checkout dining fix (lines 1428-1468)

- Expand the category check to also catch `'meal'` and title-based meal detection (activities with "Breakfast" in the title regardless of category)
- After fixing titles referencing the new hotel, also fix the `location` object — if a pre-checkout dining activity's `location.address` matches the new hotel's address, replace it with the previous hotel's address
- For pre-checkout breakfast activities that don't reference ANY hotel, add the previous hotel context to the location if the activity appears to be a hotel breakfast (e.g., title contains "hotel restaurant" or location matches hotel)

### Files to edit
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — breakfast instruction override for hotel-change days
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — broader pre-checkout dining detection

### No changes to
- No new files
- No architecture changes
- No database changes

