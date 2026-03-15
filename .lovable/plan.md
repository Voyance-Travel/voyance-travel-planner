

## Current State of Transportation Directions

The system has **two components** that show transport between activities:

| Component | Where used | Level 1 (Options) | Level 2 (Directions/Stops) |
|-----------|-----------|-------------------|---------------------------|
| `TransitModePicker` | Transport-type activities (e.g., "Taxi to British Museum") | Yes — real costs via `airport-transfers` | Yes — real Google Routes API directions with stops, line names, step-by-step |
| `TransitGapIndicator` | Gaps between regular activities | Yes — real costs via `airport-transfers` | **No** — options show a chevron-down but tapping does nothing |

Both components call the **`route-details` edge function** which uses **Google Routes API v2** with real geocoding — so the directions data is accurate. The problem is `TransitGapIndicator` fetches options but never lets you drill into an option to see the actual route steps and transit stops.

### What Needs to Happen

**Add Level 2 expansion to `TransitGapIndicator`** — matching what `TransitModePicker` already does:

**File: `src/components/itinerary/TransitGapIndicator.tsx`**

1. Add state for `expandedOptionId`, `routeDetailsCache`, `loadingRouteId`, and `showAllStepsFor` (same pattern as TransitModePicker)
2. Add a `fetchRouteDetails` function that calls `route-details` with the correct Google mode mapping (taxi→driving, train/bus→transit, walk→walking)
3. Make each option row clickable with `toggleOptionDetail` — tapping expands it to show:
   - Step-by-step directions (transit line names, stop counts, walk segments)
   - Capped at 5 steps with "+ X more steps" expand button
4. Add the `RouteDetails` type interface and step rendering UI (reuse the same markup pattern from TransitModePicker lines ~490-590)

This is a purely frontend change — the `route-details` edge function already handles all modes correctly via Google Routes API. No backend changes needed.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/itinerary/TransitGapIndicator.tsx` | Add Level 2 route details expansion with step-by-step directions per transport option |

