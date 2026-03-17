

## Fix: Hero Image Doesn't Change Per City in Multi-City Trips

### Root Cause

The hero image at the top of the TripDetail page is resolved once from `trip.destination` (e.g., "Amalfi Coast & Sicily") via `useTripHeroImage`. It never updates when the user navigates between city legs in the day selector. Both the Amalfi days and Sicily days show the same hero because the hook receives the compound destination string, not the current city.

The per-city `cityName` is already resolved per day inside `EditorialItinerary` (line 5002-5018), but this info never flows back up to control the hero image.

### The Fix

**Make the hero image city-aware for multi-city trips.**

**1. Track the active city in EditorialItinerary and expose it upward** (`EditorialItinerary.tsx`)

- The component already computes `cityName` for each day in the day selector. Add a callback prop `onActiveCityChange?: (cityName: string | null) => void`.
- When `selectedDayIndex` changes, resolve the city for that day (reuse existing logic) and call the callback.

**2. TripDetail: maintain `activeCity` state and swap hero image** (`TripDetail.tsx`)

- Add `const [activeCity, setActiveCity] = useState<string | null>(null)`.
- Pass `onActiveCityChange={setActiveCity}` to `EditorialItinerary`.
- For multi-city trips, when `activeCity` is set and differs from the overall destination, call a second `useTripHeroImage` for the active city. Use it as the displayed hero.
- For single-city trips, behavior is unchanged.

**3. Smooth transition** (`TripDetail.tsx`)

- Add a CSS transition (`transition-opacity`) on the hero `<img>` so city switches don't flash abruptly.

### Files

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/EditorialItinerary.tsx` | Add `onActiveCityChange` prop; fire it on day selection change with resolved city name. |
| 2 | `src/pages/TripDetail.tsx` | Add `activeCity` state; conditionally resolve per-city hero image; pass callback to EditorialItinerary. |

### Expected Result

- Multi-city trips: hero image updates when switching between city legs (e.g., Amalfi → Sicily shows Mt. Etna or Taormina).
- Single-city trips: no change in behavior.
- Smooth crossfade on city transitions.

