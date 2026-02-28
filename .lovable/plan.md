

# Fix Flight Import → Step 2 Mapping & Missing Leg Communication

## Problem Summary

When a user imports 4 flight segments (ATL->MAD->PMI, MAD->BOS->ATL), the Step 2 page has three issues:

1. **Positional mapping drops flights**: The editor creates 3 slots (Outbound, Mallorca->Madrid, Return) but receives 4 legs. The 4th leg (BOS->ATL) is silently dropped.
2. **Classification data is lost**: The `ManualFlightEntry` type doesn't carry `classification` (OUTBOUND, RETURN, CONNECTION, etc.) from the parser, so the editor can't intelligently group connecting flights.
3. **Missing legs don't reach Transport section**: Intelligence detects PMI->MAD is missing, but this never flows to the "Transportation Between Cities" section, which still shows its default comparison options as if nothing is booked or missing.

---

## Solution

### 1. Extend `ManualFlightEntry` with classification metadata

**File**: `src/components/itinerary/AddBookingInline.tsx`

Add optional fields to `ManualFlightEntry`:
- `classification?: 'OUTBOUND' | 'RETURN' | 'CONNECTION' | 'INTER_DESTINATION'`
- `connectionGroup?: number`

This lets the parser's classification survive through the import pipeline.

### 2. Carry classification through the FlightImportModal

**File**: `src/components/itinerary/FlightImportModal.tsx`

In `handleConfirmImport()` (line 246), include `classification` and `connectionGroup` when mapping `parsedSegments` to `ManualFlightEntry[]`:

```
classification: seg.classification,
connectionGroup: seg.connectionGroup,
```

### 3. Smart leg-to-slot mapping in MultiLegFlightEditor

**File**: `src/components/planner/flight/MultiLegFlightEditor.tsx`

Replace the positional mapping in the import rehydration effect (line 317-358) with classification-aware matching:

- **OUTBOUND + its CONNECTIONs** -> group into the outbound slot (use the first leg's departure, last leg's arrival)
- **RETURN + its CONNECTIONs** -> group into the return slot (use the first leg's departure, last leg's arrival)
- **INTER_DESTINATION** -> match to the intercity slot by comparing airport codes to `suggestedFrom`/`suggestedTo`
- **Fallback**: If no classification, fall back to airport-code matching (leg's departureAirport matches slot's suggestedFrom or arrivalAirport matches slot's suggestedTo)

For grouped connections (e.g., ATL->MAD + MAD->PMI as outbound):
- Store the primary leg (ATL->MAD) in the slot's `flight` field
- Store the connecting leg (MAD->PMI) in a new optional `connectionLegs` array on `FlightLegSlot`
- The slot header shows the full route: "ATL -> MAD -> PMI" instead of just one segment
- Both legs are preserved for the trip insert

### 4. Add `connectionLegs` to FlightLegSlot

**File**: `src/components/planner/flight/MultiLegFlightEditor.tsx`

Add to the `FlightLegSlot` interface:
```
connectionLegs?: ManualFlightEntry[]  // Additional connecting flights grouped with this slot
```

Update the slot UI to show "via MAD" or similar when connection legs exist.

### 5. Pass intelligence `missingLegs` to InterCityTransportComparison

**File**: `src/pages/Start.tsx`

- Thread `flightIntelligence` state down to the `FlightHotelStep` component (it's already available via `onIntelligenceCapture`)
- Add a `missingLegs` prop to `InterCityTransportComparison`
- When a transition matches a missing leg (fromCity/toCity), show an amber "Not yet booked" badge and a "Book this" prompt instead of the default AI comparison options

### 6. Mark booked transitions in InterCityTransportComparison

**File**: `src/components/planner/InterCityTransportComparison.tsx`

Add support for:
- `missingLegs?: Array<{ fromCity: string; toCity: string; suggestedDateRange?: { earliest: string; latest: string } }>`
- `bookedTransitions?: Record<number, { type: string; details: string }>` (transitions that already have imported flight data)

For each transition:
- If it matches a `missingLeg`: Show amber warning card with "Need flight from X to Y" + suggested booking dates
- If it has booked data: Show a green "Booked" badge instead of comparison options
- Otherwise: Show the normal AI comparison options

---

## Technical Flow After Changes

```text
User pastes confirmation
       |
       v
parse-booking-confirmation (edge function)
  -> Returns segments WITH classification + intelligence WITH missingLegs
       |
       v
FlightImportModal
  -> Maps segments to ManualFlightEntry[] WITH classification
  -> Passes intelligence via onIntelligence callback
       |
       v
handleImportAllLegs (Start.tsx)
  -> Stores legs in state
  -> Stores intelligence in flightIntelligence state
       |
       v
MultiLegFlightEditor
  -> Groups OUTBOUND+CONNECTION legs into outbound slot
  -> Groups RETURN+CONNECTION legs into return slot  
  -> Matches INTER_DESTINATION to intercity slots by airport code
  -> Shows full route per slot (e.g., "ATL -> MAD -> PMI")
       |
       v
InterCityTransportComparison
  -> Reads missingLegs from intelligence
  -> Shows "Not yet booked" warning for Mallorca->Madrid transition
  -> Shows "Booked" badge for transitions with imported data
```

## Files to Change

1. `src/components/itinerary/AddBookingInline.tsx` -- Add `classification` and `connectionGroup` to `ManualFlightEntry`
2. `src/components/itinerary/FlightImportModal.tsx` -- Pass classification through in `handleConfirmImport`
3. `src/components/planner/flight/MultiLegFlightEditor.tsx` -- Smart grouping logic, `connectionLegs` on slots, updated UI
4. `src/pages/Start.tsx` -- Thread `flightIntelligence` to `InterCityTransportComparison`, pass missing legs
5. `src/components/planner/InterCityTransportComparison.tsx` -- Handle `missingLegs` and `bookedTransitions` props

## Sequencing

1. Extend `ManualFlightEntry` with classification fields
2. Update `FlightImportModal` to carry classification through
3. Rewrite import mapping in `MultiLegFlightEditor` with smart grouping
4. Thread intelligence to `InterCityTransportComparison`
5. Add missing leg warnings and booked badges to transport comparison UI

