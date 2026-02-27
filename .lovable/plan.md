
# Add Inter-City Transport Selection to "Just Tell Us" Confirm Card

## Problem
When users describe a multi-city trip in the chat flow ("Hong Kong then Shanghai then Beijing then Tokyo"), the confirm card shows the city breakdown but doesn't let them choose **how** they'll travel between cities (train, flight, bus, car, ferry). This transport preference is never captured, so the itinerary generator has no guidance on inter-city transit.

The manual multi-city builder (`MultiCitySelector`) already has this UI -- a dropdown between each city pair. The chat flow's `TripConfirmCard` is missing it.

## Plan

### 1. Add transport selectors to `TripConfirmCard`

In the multi-city route breakdown section (lines 84-100 of `TripConfirmCard.tsx`), add a transport mode selector between each consecutive city pair. This will use the same visual pattern as `MultiCitySelector` -- a small dropdown with train/flight/bus/car/ferry icons between city rows.

The component will accept a new `onTransportChange` callback and a `transports` array prop so the parent can track selections.

### 2. Update `TripChatPlanner` to manage transport state

Add a `cityTransports` state array to `TripChatPlanner.tsx` that tracks the user's transport choice per city leg. Initialize it with defaults (e.g., 'flight') when `extractedDetails` populates with multiple cities.

Pass `cityTransports` and the setter into `TripConfirmCard`.

### 3. Wire transport preferences into trip creation

In `Start.tsx`'s `onChatDetailsExtracted` callback, read the transport selections from the confirmed details and write them to `trip_cities` rows as `transport_type` (the column already exists in the database schema).

This ensures the itinerary generator receives the user's transport preference per city leg and can plan transition days accordingly (train station logistics vs airport logistics, etc.).

## Technical Details

### Files to modify

| File | Change |
|------|--------|
| `src/components/planner/TripConfirmCard.tsx` | Add transport dropdown between each city pair in the multi-city breakdown; accept `transports` and `onTransportChange` props |
| `src/components/planner/TripChatPlanner.tsx` | Add `cityTransports` state; initialize on extraction; pass to `TripConfirmCard`; include in confirmed details passed to parent |
| `src/pages/Start.tsx` | Read transport selections from chat details; write to `trip_cities.transport_type` during insert |
| `src/types/multiCity.ts` | No changes needed -- `InterCityTransport` type already exists with the right shape |

### UI Design

The transport selector appears inline in the city breakdown:

```text
City breakdown
1. Hong Kong         4 nights
   [Train v] to Shanghai
2. Shanghai          3 nights
   [Flight v] to Beijing
3. Beijing           4 nights
   [Train v] to Tokyo
4. Tokyo             5 nights
```

Each dropdown shows: Train, Flight, Bus, Car, Ferry -- with matching icons (reusing the icon set from `MultiCitySelector`).

### Data Flow

1. User describes multi-city trip in chat
2. AI extracts cities array
3. `TripConfirmCard` renders with transport selectors (defaulting to "flight")
4. User picks transport modes and clicks "Confirm & Generate"
5. `Start.tsx` writes each city row with `transport_type` set
6. Itinerary generator reads `transport_type` from `trip_cities` and plans transition days accordingly
