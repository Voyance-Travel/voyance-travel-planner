

## Fix: "Your Hotel" Placeholder Not Replaced With Real Hotel Name (Single-City Trips)

### Root Cause

In `action-generate-trip-day.ts` (the per-day generation handler), the hotel name for the repair pipeline is resolved via:

```
hotelName: cityInfo?.hotelName || flightSel.hotelName || undefined
```

For **single-city trips**, `cityInfo` is always null (the `dayCityMap` is only built for multi-city). And `flightSel` is `trip.flight_selection` — flight data, which doesn't contain a `hotelName` field. So the repair step always gets `hotelName = undefined`, causing all injected accommodation activities to use `"Your Hotel"`.

Additionally, `tripCheck` (line 167) doesn't even fetch `hotel_selection` from the database — only `flight_selection`.

### Fix

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

Three changes:

1. **Add `hotel_selection` to the tripCheck query** (line 167):
```typescript
.select('itinerary_status, metadata, itinerary_data, flight_selection, hotel_selection')
```

2. **Extract hotel name from `hotel_selection`** — add a helper block after `tripCheck` to resolve the hotel name for single-city trips:
```typescript
// Resolve hotel name from hotel_selection for single-city trips
const tripHotelSel = tripCheck?.hotel_selection;
let tripHotelName: string | undefined;
let tripHotelAddress: string | undefined;
if (tripHotelSel) {
  const hotelObj = Array.isArray(tripHotelSel) && tripHotelSel.length > 0
    ? tripHotelSel[0]
    : (typeof tripHotelSel === 'object' ? tripHotelSel : null);
  if (hotelObj?.name) {
    tripHotelName = hotelObj.name;
    tripHotelAddress = hotelObj.address || '';
  }
}
```

3. **Use `tripHotelName` as fallback** in all places where hotel name is resolved for repair (~4 locations):
```typescript
// Before:
hotelName: cityInfo?.hotelName || flightSel.hotelName || undefined,

// After:
hotelName: cityInfo?.hotelName || tripHotelName || undefined,
hotelAddress: cityInfo?.hotelAddress || tripHotelAddress || '',
```

Also update the `hasHotel` detection (line 599) and the forward-ref fix (line 605) similarly.

### Summary

| File | Change |
|---|---|
| `action-generate-trip-day.ts` | Add `hotel_selection` to DB query; extract hotel name; use as fallback in repair inputs for single-city trips |

