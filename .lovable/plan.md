

## Fix: Checkout Shows Wrong Hotel on Split-Stay Days

### Root Cause

`action-generate-trip-day.ts` runs a **second repair pass** after `action-generate-day.ts` already ran the first one. The first pass (via `compile-day-facts.ts`) correctly detects the hotel change and sets the checkout title to "Checkout from Four Seasons Ritz". But the second repair pass in `action-generate-trip-day.ts` always passes `isHotelChange: false` and `previousHotelName: undefined` because it never detects split-stay hotel changes for single-city trips.

During the second repair's **title normalization** (Step 11), the checkout title gets overwritten to use the current day's hotel (`hn` = "Palácio Ludovice") instead of the previous hotel.

### Fix

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

After the `tripHotelName` resolution block (line ~220), add hotel change detection for split-stay scenarios:

1. When `hotelList.length > 1` and `dayNumber > 1`, resolve the **previous day's hotel** using the same date-matching logic
2. Compare previous day's hotel name to current day's — if different, set `tripIsHotelChange = true` and `tripPreviousHotelName` to the previous hotel
3. Pass these values to the repair call at lines 819-820 instead of the always-false `cityInfo?.isHotelChange`

This is ~15 lines of new code in one file. The repair pipeline already handles hotel changes correctly — it just wasn't being told about them.

### Technical Details

```
// After tripHotelName is resolved (~line 220):
let tripIsHotelChange = false;
let tripPreviousHotelName: string | undefined;

if (hotelList.length > 1 && dayNumber > 1 && startDate) {
  const prevDayDate = new Date(startDate);
  prevDayDate.setDate(prevDayDate.getDate() + dayNumber - 2);
  const prevDateStr = prevDayDate.toISOString().split('T')[0];
  
  const prevHotel = hotelList.find(h => {
    const cin = h.checkInDate; const cout = h.checkOutDate;
    return cin && cout && prevDateStr >= cin && prevDateStr < cout;
  });
  
  if (prevHotel?.name && tripHotelName && prevHotel.name !== tripHotelName) {
    tripIsHotelChange = true;
    tripPreviousHotelName = prevHotel.name;
  }
}
```

Then update the repair call:
```
isHotelChange: cityInfo?.isHotelChange || tripIsHotelChange,
previousHotelName: (cityInfo as any)?.previousHotelName || tripPreviousHotelName,
```

