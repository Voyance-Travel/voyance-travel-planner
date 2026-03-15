

## Mid-Day & Early Morning Transport — Trim Activities After Departure

### Problem

When a departure is at 6 AM or 10 AM, the current system inserts the transport card chronologically but **leaves all the day's activities in place**. A traveler with a 6 AM flight to Paris still sees breakfast at 8 AM, sightseeing at 10 AM, lunch at noon — all in a city they've already left.

The departure card needs to act as a **cutoff**: activities scheduled **after** the departure time should be removed from that day.

### Solution

In the departure-day injection block (`EditorialItinerary.tsx`, lines 1448–1532), after inserting the departure card chronologically, **filter out** any non-synthetic activities that start at or after the departure time.

#### Change: `src/components/itinerary/EditorialItinerary.tsx` (departure day block, ~line 1517–1530)

After inserting the departure card into `updatedActivities`, add a filter step:

```typescript
// Remove regular activities that start at or after departure time
// (the traveler has left the city)
const depMinutes = parseInt(cardTime.split(':')[0]) * 60 + parseInt(cardTime.split(':')[1] || '0');
updatedActivities = updatedActivities.filter(act => {
  // Keep all synthetic cards (hotel check-out, transport, etc.)
  if ((act as any).__syntheticTravel || (act as any).__syntheticDeparture || 
      (act as any).__interCityTransport || (act as any).__hotelCheckout ||
      act.id.startsWith('hotel-') || act.id.startsWith('departure-') || 
      act.id.startsWith('travel-')) {
    return true;
  }
  // Keep activities that start before departure
  if (!act.startTime) return true; // no time = keep (safe fallback)
  const actMin = parseInt(act.startTime.split(':')[0]) * 60 + parseInt(act.startTime.split(':')[1] || '0');
  return actMin < depMinutes;
});
```

This means:
- **6 AM flight**: Only pre-dawn activities remain (likely none — clean day with just the transport card)
- **10 AM train**: Morning breakfast stays, everything from 10 AM onward is removed
- **6 PM flight (default)**: Most of the day's activities stay, only late evening gets trimmed
- **No departure time (18:00 fallback)**: Behaves exactly as today — most activities kept

#### Edge case: Allow a buffer before departure

Optionally, subtract 60–90 minutes from the departure time as the cutoff, to account for getting to the airport/station. E.g., a 10 AM flight means activities after 8:30 AM are removed (need to be at airport by ~8 AM).

```typescript
const bufferMinutes = tType === 'flight' ? 90 : tType === 'train' ? 45 : 30;
const cutoffMinutes = depMinutes - bufferMinutes;
// Use cutoffMinutes instead of depMinutes in the filter
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | After departure card insertion (~line 1530), filter out activities at/after departure time (with transport-type buffer) |

