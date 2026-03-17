

## Fix: Dedicated Travel Card Missing for Final Departure (Airport/Train Station)

### Problem

The `InterCityTransportCard` only renders in two scenarios:
1. **Transition days** (multi-city, moving between cities) — via `isTransitionDay`
2. **Inter-city departure days** (last day in a city before the *next* city) — via `isDepartureDay`

Neither covers the **final departure** of the trip — going home. This is because:
- `isDepartureDay` in `buildDayCityMap` requires a `nextCity` to exist (`isDeparture = isLastDayOfCity && !!nextCity`)
- Single-city trips never enter this code path at all (no `dayCityMap`)
- The last city in a multi-city trip has no `nextCity`, so it's never flagged

There's an `ArrivalGamePlan` component for Day 1 but **no equivalent departure card** for the last day. The return flight info exists in `flightSelection.return` but is only used for schedule constraints, not for rendering a travel card.

### Fix

Two changes:

**1. `src/services/itineraryAPI.ts` — Flag the trip's final day as a departure day**

In `buildDayCityMap`, after the existing loop, detect the absolute last day and mark it with new fields: `isFinalDeparture: true` plus transport details from the return flight (pulled from `flight_selection` or trip metadata). Also handle single-city trips in `generateItinerary` by tagging the last day similarly.

Alternatively (simpler approach): handle this entirely in the UI layer since `flightSelection.return` is already available there.

**2. `src/components/itinerary/EditorialItinerary.tsx` — Inject a departure travel card on the last day**

In the `useMemo` that builds synthetic cards (~line 1416), add a new block after the existing `isDepartureDay` logic:

```
// === Final departure day: inject return flight/train card ===
if (dayIndex === rawDays.length - 1 && !d.isDepartureDay) {
  // Use flightSelection.return or last leg to build a departure card
  // with __interCityTransport + __travelMeta like the existing patterns
}
```

This will:
- Check if we're on the last day and no inter-city departure card already exists
- Pull return flight data from `flightSelection.return` (or the last `legs[]` entry)
- Build an `InterCityTransportCard` with the return flight's carrier, times, route
- Insert it chronologically (same insertion logic as existing departure cards)

The card will show the same styled travel card (blue for flights, emerald for trains) with route visualization, departure/arrival times, and expandable booking details.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/EditorialItinerary.tsx` | Add final-departure travel card injection in the `useMemo` block (~line 1600), using `flightSelection` return data. Access `flightSelection` which is already available in the component scope. |

Single file change — the data is already available, we just need to create the synthetic card.

