

## Fix: Reject Mainland Venues for Water-Bound / Car-Free Destinations

### Problem

Venice (and similar destinations like Santorini old town, Hydra, etc.) are walkable-only destinations separated from their mainland by water. The venue enrichment distance guard uses a 50km radius from destination center, and Mestre is only ~8km away — so mainland wellness spas with 30173 postal codes pass validation despite being unreachable on foot from a Venice island hotel.

### Solution

Add a **hotel-proximity guard** to the venue verification pipeline. When the hotel coordinates are known, reject any enriched venue that is more than a destination-appropriate radius from the hotel. For water-bound / car-free destinations, use a tight radius (e.g., 5km). For normal cities, use a generous radius (e.g., 15km).

### Changes

**1. `supabase/functions/generate-itinerary/venue-enrichment.ts`**

Add a constant map of destinations that are water-bound or car-free, with a tight max radius:

```typescript
const TIGHT_RADIUS_DESTINATIONS: Record<string, number> = {
  'venice': 5,      // Island — no cars, no mainland venues
  'murano': 3,
  'burano': 3,
  'santorini': 8,
  'hydra': 4,
  'mykonos': 8,
  'capri': 5,
  'macau': 6,
};
const DEFAULT_HOTEL_RADIUS_KM = 15;
```

Modify `verifyVenueWithGooglePlaces` to accept an optional `hotelCoordinates` parameter. After the existing 50km destination-center check (line 222), add a second tighter check:

```typescript
// Hotel proximity guard — reject venues unreachable from hotel
if (hotelCoordinates && place.location) {
  const destLower = destination.toLowerCase();
  const tightRadius = Object.entries(TIGHT_RADIUS_DESTINATIONS)
    .find(([key]) => destLower.includes(key))?.[1];
  const maxRadius = tightRadius ?? DEFAULT_HOTEL_RADIUS_KM;
  
  const hotelDistKm = haversineDistanceKm(
    hotelCoordinates.lat, hotelCoordinates.lng,
    place.location.latitude, place.location.longitude
  );
  if (hotelDistKm > maxRadius) {
    console.log(
      `[Stage 4] ❌ REJECTED venue "${venueName}" → ${hotelDistKm.toFixed(1)}km from hotel (max ${maxRadius}km for ${destination})`
    );
    return null;
  }
}
```

**2. Thread hotel coordinates through the enrichment pipeline**

- `enrichActivity()` — add optional `hotelCoordinates?: { lat: number; lng: number }` param
- `enrichActivityWithRetry()` — pass it through
- `enrichItinerary()` — accept hotel coordinates from caller, pass to each activity enrichment
- `verifyVenueWithDualAI()` — pass hotel coordinates to `verifyVenueWithGooglePlaces`

**3. `supabase/functions/generate-itinerary/generation-core.ts`**

Where `enrichItinerary` is called, extract hotel coordinates from the trip context (hotel_selection or hotelOverride) and pass them in.

### Why Not Just Tighten the 50km Guard?

Many legitimate cities span 15-30km (LA, London, Tokyo). The fix is destination-aware: only water-bound / car-free destinations get the tight 5km radius. Normal cities get a 15km hotel-proximity check that still catches egregious outliers without breaking suburban venue discovery.

### Summary

| File | Change |
|---|---|
| `venue-enrichment.ts` | Add `TIGHT_RADIUS_DESTINATIONS` map; add hotel-proximity guard after destination-distance check; thread `hotelCoordinates` through all enrichment functions |
| `generation-core.ts` | Extract hotel coords from context; pass to `enrichItinerary` |

