

## Plan: Add Real Google Maps Route Details to TransitModePicker

### Current State
The `TransitModePicker` component is already fully integrated and working:
- Calls `airport-transfers` edge function for transport options
- Has two-level expansion (Level 1: options list, Level 2: route details)
- Walk option added client-side, airport filtering in place
- Three-dot menu separated from row tap

**What's missing**: Level 2 shows generic route text from `airport-transfers` (e.g., "Direct door-to-door"). The user wants real step-by-step directions from Google Maps Directions API.

### Changes

#### 1. Create `route-details` edge function
**New file: `supabase/functions/route-details/index.ts`**

Calls Google Maps Directions API with origin, destination, and mode (`driving`/`transit`/`walking`). Returns formatted step-by-step directions with transit details (line name, departure/arrival stops, number of stops). Uses existing `GOOGLE_MAPS_API_KEY` secret.

Add to `supabase/config.toml`:
```toml
[functions.route-details]
  verify_jwt = false
```

#### 2. Integrate route details into TransitModePicker Level 2
**File: `src/components/itinerary/TransitModePicker.tsx`**

- Add state: `routeDetailsCache` (map of option ID → route data), `loadingRouteId`
- When user expands an option (Level 2), call `route-details` edge function if not cached
- Map mode: taxi/uber → `driving`, train/bus/transit → `transit`, walk → `walking`
- Display step-by-step directions with numbered steps, transit details (line name, stops), and walking segments
- Fall back to generic `option.route` text if Directions API returns no results
- Show small loading spinner while fetching

#### 3. No changes to EditorialItinerary.tsx
The integration is already complete there.

### Technical Details

**Route details response shape:**
```ts
interface RouteDetails {
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    travelMode: string;
    transitDetails?: {
      lineName: string;
      vehicleType: string;
      departureStop: string;
      arrivalStop: string;
      numStops: number;
    };
  }>;
  summary: string;
  totalDuration: string;
  totalDistance: string;
}
```

**UI rendering**: Each step gets a numbered circle + instruction text. Transit steps show line name + stops in a highlighted badge. Walking segments show distance/duration.

