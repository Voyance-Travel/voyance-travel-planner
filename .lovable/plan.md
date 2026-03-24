

## Fix: Multi-City Itinerary Uses Wrong Hotel + Missing Second Hotel Check-In

### Problem (2 bugs)

**Bug 1 — Wrong hotel in itinerary for multi-city trips**
The system correctly stores per-city hotel data in `trip_cities.hotel_selection` and builds it into `multiCityDayMap`. The multi-city prompt injection (line ~1936) correctly tells the AI which hotel to use. However, `context.hotelData` is populated once from `trips.hotel_selection` via `extractHotelData()` — which always grabs the first hotel. The prompt library functions (`buildDayPrompt`, `buildArrivalDayPrompt`, etc.) all receive this single `hotelData` object, so they inject the wrong hotel name into their structured prompts. The AI sees two conflicting hotel names and sometimes follows the wrong one.

**Bug 2 — No check-in generated for second hotel**
When building the `dayCityMap`, each day for a given city gets the same hotel (hotel_selection[0] from that city). But the user has TWO hotels within one city segment (split stay within a multi-city trip). The `dayCityMap` doesn't account for date-based hotel switching within a single city, so the second hotel is never injected and no check-in/checkout transition is generated.

### Root Cause

1. **`context.hotelData`** is set at Stage 1.4.5 (line ~5025) from `trips.hotel_selection` and never updated per-day. When `generateSingleDayWithRetry` calls `buildDayPrompt`, it passes this stale single-hotel data, which conflicts with the per-city multi-city prompt.

2. **`dayCityMap` builder** (line ~1356-1393) extracts `rawHotel[0]` per city but ignores `checkInDate`/`checkOutDate` on split-stay hotels. All nights in a city get the same hotel even when the user has date-scoped hotels within that city.

### Fix — 1 file

**`supabase/functions/generate-itinerary/index.ts`**

**Change 1: Override `context.hotelData` per-day before calling prompt library** (~line 1537-1543)

Before calling `buildDayPrompt`, check if `dayCity?.hotelName` exists and override the hotel data passed to the prompt library:

```typescript
const effectiveHotelData = (dayCity?.hotelName)
  ? { hasHotel: true, hotelName: dayCity.hotelName, hotelAddress: dayCity.hotelAddress, hotelNeighborhood: dayCity.hotelNeighborhood, checkInTime: dayCity.hotelCheckIn, checkOutTime: dayCity.hotelCheckOut }
  : (context.hotelData || { hasHotel: false });
```

Then pass `effectiveHotelData` instead of `hotelData` to `buildDayPrompt`, `buildArrivalDayPrompt`, and `buildDepartureDayPrompt`. This ensures the prompt library tells the AI the correct hotel for each day.

**Change 2: Date-aware hotel resolution in `dayCityMap` builder** (~line 1356-1393)

When building the day map for each city, resolve the hotel based on the day's date against `checkInDate`/`checkOutDate` on each hotel in the array:

```typescript
// For each night n in a city, compute the actual date
const dayDate = new Date(startDate);
dayDate.setDate(dayDate.getDate() + dayMap.length);
const dateStr = dayDate.toISOString().split('T')[0];

// If hotel_selection is an array with date ranges, find the matching hotel
let cityHotel = null;
if (Array.isArray(rawHotel) && rawHotel.length > 1) {
  cityHotel = rawHotel.find(h => h.checkInDate && h.checkOutDate && dateStr >= h.checkInDate && dateStr < h.checkOutDate) || rawHotel[0];
} else {
  cityHotel = Array.isArray(rawHotel) && rawHotel.length > 0 ? rawHotel[0] : rawHotel;
}
```

Also set `isFirstDayInCity` and `isLastDayInCity` flags when the hotel changes within a city (to trigger check-in/checkout generation):

```typescript
const prevDayHotel = dayMap.length > 0 ? dayMap[dayMap.length - 1].hotelName : null;
const isHotelChange = prevDayHotel && prevDayHotel !== hotelName && dayMap[dayMap.length - 1]?.cityName === city.city_name;
```

When `isHotelChange` is true, mark that day entry with a flag so the prompt injection generates checkout from the old hotel and check-in at the new one.

**Change 3: Inject hotel-change prompt on transition days within a city** (~line 1936 area)

Add a condition: if the hotel changed from the previous day (same city), inject a hotel transition prompt similar to:
```
📍 HOTEL CHANGE: Traveler checks out of "{previousHotel}" and checks into "{newHotel}". 
Plan checkout in the morning, then check-in at the new hotel, then activities.
```

### Impact
- Existing multi-city trips with per-city hotels will now get the correct hotel in ALL prompt layers (not just the multi-city overlay)
- Split-stay hotels within a single city segment will be resolved by date
- Check-in/checkout activities will be generated when switching hotels mid-city

### Files
- `supabase/functions/generate-itinerary/index.ts` — 3 changes: per-day hotel override for prompt library, date-aware hotel resolution in dayCityMap, hotel-change prompt injection

