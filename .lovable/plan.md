

# Fix Flight Legs: Sync, Reorder, and Overnight Flight Handling

## Problems Identified

1. **Arrival Game Plan shows wrong data on Day 1 for overnight flights**: The ArrivalGamePlan component on Day 1 shows "Arrive at airport by 7:15 PM" and "Landing at 12:15 (MAD)" even though the flight departs July 1 at 21:45 and lands July 2 at 12:15. Day 1 should show a "Departure Day" plan (pack, go to airport, board), and Day 2 should show the "Arrival Game Plan" with landing info.

2. **Leg 2 (MAD to PMI) is wrongly marked as "Return from destination"**: The `isDestinationDeparture` flag got set on the MAD-to-PMI leg, which actually flies TO the destination (Mallorca). The user needs both mark buttons clearly visible on every leg so they can fix this.

3. **Flight legs not draggable**: The new `SortableFlightLegCards` component was added but may not be rendering drag handles properly due to the `effectiveIsEditable` being false when the permission check hasn't resolved yet, or the component keys using array indices preventing proper DnD behavior.

4. **Flight Sync Warning is misleading**: It compares the destination arrival leg's time against Day 1 activities, but for overnight flights, the arrival is on Day 2 -- so the comparison is against the wrong day.

## Solution

### 1. ArrivalGamePlan: Handle overnight/cross-day flights on Day 1
**File**: `src/components/itinerary/EditorialItinerary.tsx` (lines 3879-3889)

When `selectedDayIndex === 0` (Day 1), detect if the outbound flight is cross-day (departure date != arrival date). If so:
- Show a **"Departure Day" game plan** instead of an arrival plan -- with tips like "Pack your bags", "Head to airport by X:XX", "Board your overnight flight"
- Move the ArrivalGamePlan to Day 2 instead

Also update the `ArrivalGamePlan` component itself to accept a `isDepartureDay` prop for rendering departure-specific content.

### 2. ArrivalGamePlan: Show arrival info on Day 2 for cross-day flights
**File**: `src/components/itinerary/EditorialItinerary.tsx` (lines 3879-3920)

When `selectedDayIndex === 1` and the outbound is a cross-day flight, show the full ArrivalGamePlan with landing time, transfer info, and post-landing tips.

### 3. Fix FlightSyncWarning to compare against the correct day
**File**: `src/components/itinerary/EditorialItinerary.tsx` (lines 3672-3677)

The FlightSyncWarning currently always compares against `days[0]`. For cross-day flights, it should compare against `days[1]` (Day 2) since that's when the traveler actually arrives.

### 4. Fix SortableFlightLegCards key stability for DnD
**File**: `src/components/itinerary/SortableFlightLegCards.tsx`

The current `key={idx}` on flight cards breaks DnD because when legs reorder, indices change but React reuses DOM nodes. Change to use a stable key derived from the leg data (e.g., `${leg.flightNumber}-${leg.departure?.airport}-${leg.arrival?.airport}`).

### 5. Ensure both mark buttons always appear
**File**: `src/components/itinerary/SortableFlightLegCards.tsx` (line 228)

Both "Mark as destination arrival" and "Mark as departure from destination" buttons already render for all legs when `totalLegs > 1 && isEditable`. The issue may be that `effectiveIsEditable` is false. Check the condition and ensure the mark buttons also show for non-editable viewers who are the trip owner.

### 6. Add "Mark as destination arrival" button visibility on Leg 1
Currently Leg 1 (ATL to MAD) only shows "Mark as departure from destination" in the screenshot. Both buttons should be visible. Verify the rendering condition is correct (it should be `totalLegs > 1` only).

## Files to Change

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Detect cross-day flight for Day 1 ArrivalGamePlan; show departure plan on Day 1, arrival plan on Day 2; fix FlightSyncWarning day comparison |
| `src/components/itinerary/SortableFlightLegCards.tsx` | Fix key stability for DnD; ensure both mark buttons render correctly |

## Technical Details

**Cross-day detection logic** (reuse from cascade):
```typescript
const outboundLeg = destinationArrivalLeg || allFlightLegs[0];
const isCrossDayFlight = outboundLeg?.departure?.date && outboundLeg?.arrival?.date
  && outboundLeg.arrival.date.substring(0, 10) > outboundLeg.departure.date.substring(0, 10);
```

**Stable DnD keys**:
```typescript
key={`${leg.flightNumber || ''}-${leg.departure?.airport || ''}-${leg.arrival?.airport || ''}-${idx}`}
```

**Day 1 departure plan content**:
- "Head to airport by {recommendedTime}" (2.5h before departure for international)
- "Your {airline} {flightNumber} departs at {departureTime}"
- "Overnight flight -- you'll arrive {arrivalDate} at {arrivalTime}"
- No destination sightseeing tips

