## Inter-City Transport Activity Card on Departure Day

### The Problem

Currently, inter-city transport only appears as a synthetic "Travel Summary" card on the **transition day** (first day of the arriving city). The user wants a proper activity card on the **last day of the departing city** — e.g., "Train to Paris at 6:00 PM" — so the traveler sees departure logistics in their schedule.

### How It Works Today

1. `buildDayCityMap()` in `itineraryAPI.ts` tags day 1 of each new city with `isTransitionDay = true`
2. `EditorialItinerary.tsx` (line ~1265) picks up `isTransitionDay` days and injects a synthetic travel summary card at the **top** of that day
3. The **last day of the departing city** has no transport card at all — the user doesn't see "leave at X time" in their schedule

### The Fix

**Add a `isDepartureDay` flag** to the day-city map, and inject a departure transport activity card on the last day of each city (before a city change).

#### 1. `src/services/itineraryAPI.ts` — Extend `buildDayCityMap`

Add `isDepartureDay`, `departureTo`, and `departureTransport` fields. The last day of each city (before the next city begins) gets flagged:

```text
Day 1: London          
Day 2: London          
Day 3: London          isDepartureDay=true, departureTo="Paris", departureTransport={...from next city's trip_cities row}
Day 4: Paris           isTransitionDay=true (existing)
Day 5: Paris           
```

The transport data comes from the **next city's** `trip_cities` row (which stores "how I got to this city").

#### 2. `src/components/itinerary/EditorialItinerary.tsx` — Inject departure transport card

In the same `useMemo` that handles transition day synthetic cards (~line 1265), add logic for `isDepartureDay`:

- Build an activity card like: "Train to Paris" / "Flight to Casablanca"
- If user provided transport details (departure time, carrier, etc.), use those for the card time and description
- If no transport data exists, inject a generic placeholder: "Transfer to Paris" at end of day (e.g., 18:00)
- The card uses `category: 'transit'`, `type: 'transit'`, tagged with `__syntheticDeparture: true` to avoid duplication
- Insert it chronologically based on departure time, or at end of day if no time specified

#### 3. `src/components/itinerary/EditorialItinerary.tsx` — Render the departure card

The departure card renders as a regular activity card (same as any other activity in the timeline) but with transport-specific styling:

- Transport icon (plane/train/bus/car/ferry)
- Title: "[Mode] to [City]"
- Time from transport details or generic "Evening"
- If details exist: carrier, flight number, duration shown in description
- If no details: shows "Plan your transport" hint

#### Data Flow

```text
trip_cities table
  └─ city[1].transport_type = "train"
  └─ city[1].transport_details = { departureTime: "14:30", carrier: "Eurostar" }
      │
      ▼
buildDayCityMap() tags last day of city[0] as isDepartureDay
  with departureTo = city[1].city_name, departureTransport = city[1] transport data
      │
      ▼
EditorialItinerary useMemo injects synthetic activity card
  "Train to Paris · Eurostar · Departs 14:30"
  inserted at 14:30 in the day's timeline
```

### Files to Modify


| File                                              | Change                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/itineraryAPI.ts`                    | Extend `buildDayCityMap` to flag `isDepartureDay` on last day of each city, attach next city's transport data                        |
| `src/components/itinerary/EditorialItinerary.tsx` | Add `isDepartureDay` to `EditorialDay` type; inject synthetic departure transport card in the `useMemo` that handles transition days |


### Edge Cases Handled

- **No transport data**: Generic "Transfer to [City]" placeholder at 18:00
- **Single-city trip**: No departure cards (no city changes)
- **Last city**: Depart to Airport
- **Duplicate prevention**: `__syntheticDeparture` flag checked before injection