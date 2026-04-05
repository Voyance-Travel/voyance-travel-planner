

## Diagnosis: Phantom Hotel Activities After Sharing/Navigation

### Root Cause

The `onBookingAdded` callback in `TripDetail.tsx` (line 2999) fires on **every** booking-related action — hotel saves, flight saves, transport saves, and even flight order updates. Each time it fires, it:

1. Re-fetches trip data from DB
2. Runs `injectHotelActivitiesIntoDays` or `injectMultiHotelActivities` which strips and re-injects check-in/checkout activities
3. Applies in-memory hotel name patches to accommodation activities (including "Return to Hotel")
4. **Saves the modified itinerary back to DB** (line 3100-3108) via `saveItineraryOptimistic`

The problem: when this runs for a non-hotel event (e.g., flight order update, transport save), the injection logic still executes. If the existing itinerary already has properly placed hotel activities from generation, the strip → re-inject cycle can:
- Create timing conflicts where `cascadeFixOverlaps` pushes activities to unexpected times
- Re-inject check-in/checkout cards that duplicate existing AI-generated ones
- Save these duplicates to DB, making them persist across refreshes

Additionally, the `injectHotelActivitiesIntoDays` function calls `stripExistingHotelActivities` which only strips activities with `category === 'accommodation'` AND specific title keywords. If an AI-generated "Return to Hotel" has `category: 'stay'` or a slightly different title pattern, it won't be stripped — leading to duplicates.

### Fix — Two Parts

**Part 1: Guard hotel injection in `onBookingAdded`** (`src/pages/TripDetail.tsx`)

Add a guard so the hotel injection logic inside `onBookingAdded` only runs when the hotel data has actually changed. Compare the hotel selection before and after the refetch:

```typescript
// Before injection, check if hotel data actually changed
const prevHotelJson = JSON.stringify(trip?.hotel_selection);
const newHotelJson = JSON.stringify(updatedTrip.hotel_selection);
const prevCityHotels = JSON.stringify(tripCities.map(c => c.hotel_selection));
const newCityHotels = JSON.stringify(updatedCities.map(c => c.hotel_selection));
const hotelChanged = prevHotelJson !== newHotelJson || prevCityHotels !== newCityHotels;

if (hotelChanged && currentDays.length > 0) {
  // ... existing injection logic ...
}
```

This prevents the injection from running when only flights or transport changed.

**Part 2: Strengthen `stripExistingHotelActivities` idempotency** (`src/utils/injectHotelActivities.ts`)

Expand the strip function to also remove activities matching broader accommodation patterns (not just check-in/checkout):

```typescript
// Also strip "Return to" and "Freshen up" activities with deterministic IDs
// to prevent double-injection scenarios
if (a.id.startsWith('hotel-dropbags-')) return false;
```

And ensure the injection doesn't add activities when the day already has properly-timed AI-generated equivalents.

**Part 3: Add safety check for midnight activities** (`src/utils/injectHotelActivities.ts`)

After `cascadeFixOverlaps`, add a post-check that removes any injected accommodation activity that ended up at 00:00 (midnight spillover):

```typescript
// Post-injection safety: remove any accommodation activity at 00:00-00:59
// These are cascade artifacts, not real activities
updated = updated.map(day => ({
  ...day,
  activities: day.activities.filter(a => {
    if (a.category !== 'accommodation') return true;
    const hour = parseInt((a.startTime || '06:00').split(':')[0], 10);
    if (hour === 0 && (a.id.startsWith('hotel-checkin-') || a.id.startsWith('hotel-checkout-'))) return false;
    return true;
  }),
}));
```

### Files to Edit
- `src/pages/TripDetail.tsx` — add hotel-change guard in `onBookingAdded` (~line 3010)
- `src/utils/injectHotelActivities.ts` — add midnight safety check in both injection functions

