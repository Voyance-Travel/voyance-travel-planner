

## Fix: Missing Checkout/Check-in on Split-Stay Transition Days

### Problem

On a split-stay day (same city, different hotel), the itinerary has no "Checkout from Hotel A" and no "Check-in at Hotel B" activities. The traveler just teleports between hotels.

**Root cause:** The repair pipeline's check-in and checkout guarantees only fire for specific day types, and split-stay transitions aren't covered:

- **Check-in guarantee** (step 7): fires on `dayNumber === 1 || isTransitionDay` — but `isTransitionDay` means a *city change*, not a hotel change within the same city
- **Checkout guarantee** (step 8): fires on `isLastDay || isLastDayInCity` — but on a split-stay, you're NOT leaving the city

Meanwhile, `generation-core.ts` already detects `isHotelChange` and `previousHotelName` and tells the AI about it in the prompt, but **never passes these to `repairDay`**. So even if the AI forgets to include checkout/check-in cards, the repair pipeline can't fix it.

### Changes

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

1. **Add `isHotelChange` and `previousHotelName` to `RepairDayInput`**: Two new optional fields so the repair pipeline knows this is a split-stay transition day.

2. **Extend checkout guarantee (step 8)**: Add `isHotelChange` as a trigger condition. When `isHotelChange` is true, inject "Checkout from {previousHotelName}" at 11:00 AM if no checkout activity exists. Use `previousHotelName` (not the current hotel) for the title/location.

3. **Extend check-in guarantee (step 7)**: Add `isHotelChange` to the `needsCheckIn` condition. When `isHotelChange` is true, inject "Check-in at {hotelName}" (the NEW hotel) at ~12:00 if no check-in exists — placed AFTER the checkout activity.

4. **Order enforcement**: Ensure checkout comes before check-in on hotel-change days. If both are injected, checkout at 11:00, check-in at 12:00.

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

5. **Pass `isHotelChange` and `previousHotelName` to `repairDay`**: Extract these from `cityInfo` (already available via `dayCityMap`) and include them in the repair input.

### Expected Result
Split-stay Day 3: Breakfast → **Checkout from Hotel A (11:00)** → **Check-in at Hotel B (12:00)** → Explore → Dinner → Return to Hotel B

