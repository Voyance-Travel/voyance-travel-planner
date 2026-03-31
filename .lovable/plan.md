

## Fix: Single-City Split Stays — Per-Day Hotel Resolution

### Problem
When users add multiple hotels with date ranges for a single-city trip (split stay), the AI and repair pipeline ignore the per-day hotel mapping. Every day uses the first hotel's name because:

1. **`getFlightHotelContext`** (line 350): Sets `hotelName` to `hotelRaw[0]` for split stays — no per-day resolution
2. **`compile-day-facts.ts`** (line 67): Per-day hotel resolution only runs inside the `tripCities.length > 1` block (multi-city). Single-city trips skip this entirely, so `resolvedHotelOverride` stays null
3. **`action-generate-trip-day.ts`**: `tripHotelName` is extracted from `hotel_selection[0]` — always the first hotel. This flows into `repairBookends` and post-processing

The AI does receive the split-stay schedule in its prompt context, but without a day-specific enforcement block (`🏨 ACCOMMODATION FOR THIS DAY: "Hotel X"`), it often ignores it or defaults to the first hotel.

### Fix (2 files)

**File 1: `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`**

After the multi-city `tripCities` block (after line ~145), add a **single-city split-stay resolver**. When `resolvedHotelOverride` is still null and `tripId` is set:

- Fetch `hotel_selection` from the trips table
- If it's an array with 2+ hotels with dates, resolve the correct hotel for the current day using the same date-matching logic already used for multi-city (lines 82-94)
- Set `resolvedHotelOverride` with the matched hotel
- This ensures the hotel enforcement prompt block (lines 314-325) fires even for single-city trips — remove the `resolvedIsMultiCity` gate on line 322 so it applies universally

**File 2: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

Update `tripHotelName` / `tripHotelAddress` resolution to be date-aware for split stays:

- When `hotel_selection` is an array with 2+ hotels, resolve the correct hotel for the current `dayNumber` using dates (same logic)
- This ensures `repairBookends` and forward-ref cleanup use the right hotel name per day

### Technical Detail

The date-matching logic (already proven in compile-day-facts lines 82-94):
```typescript
// Match hotel by date
const dayDate = /* computed from startDate + dayNumber */;
const matched = hotelList.find(h => {
  const cin = h.checkInDate || h.check_in_date;
  const cout = h.checkOutDate || h.check_out_date;
  return cin && cout && dayDate >= cin && dayDate < cout;
});
// Fallback: distribute nights evenly across hotels
if (!matched) {
  const daysPerHotel = Math.max(1, Math.floor(totalDays / hotelList.length));
  const idx = Math.min(Math.floor((dayNumber - 1) / daysPerHotel), hotelList.length - 1);
  return hotelList[idx];
}
```

### Summary

| File | Change |
|---|---|
| `compile-day-facts.ts` | Add single-city split-stay hotel resolver; remove multi-city gate on hotel enforcement prompt |
| `action-generate-trip-day.ts` | Make `tripHotelName` date-aware for split stays so repair pipeline uses correct hotel per day |

