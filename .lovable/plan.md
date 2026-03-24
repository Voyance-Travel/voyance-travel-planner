

## Fix: Last Day in City Generates Airport Itinerary for Non-Flight Departures

### Problem

On a multi-city trip where the next leg is a **train** (not a flight), the last day in a city generates airport-based logistics: "Transfer to Airport," "Departure – Boarding & Security," etc. The user provided train details in step 2, but the departure-day prompt ignores them.

Two root causes across two generation paths:

### Root Cause 1: `buildDayPrompt` in prompt-library.ts (full-trip generation)

`buildDayPrompt` (line 1448) checks `isLastDay = dayNumber === totalDays`. For a mid-trip last-day-in-city, `isLastDay` is **false**, so it returns a **regular day prompt** — not a departure prompt. The multi-city overlay (`multiCityPrompt`) correctly says "CHECKOUT DAY, next leg is TRAIN," but the prompt library has no notion of "last day in city." The AI gets conflicting signals — regular day structure + checkout instructions — and hallucinates airport activities because `flightContext` still contains the trip's overall return flight data.

### Root Cause 2: `generate-day` handler departure logic (single-day generation, line 8193)

When `resolvedIsLastDayInCity` is true, it enters the departure logic block. The **first** check is `hasReturnFlight` (line 8195), which looks at `flightContext.returnDepartureTime` — this is the **overall trip's** return flight, not this city's departure. So on a mid-trip city departure by train, if the trip has a return flight stored, it generates full airport departure logistics. The non-flight transport check (`resolvedNextLegTransport`) only runs in the `else if (hasHotelData)` fallback (line 8462), which is never reached because `hasReturnFlight` is true.

Additionally, the transport details from `trip_cities.transport_details` (departure time, station name, carrier) are captured for **arrival/transition days** (line 7438-7460) but **never captured for the departure side** — the last day in city only gets `resolvedNextLegTransport` (mode) and `resolvedNextLegCity` (name), not the schedule details.

### Fix — 2 files

**File 1: `supabase/functions/generate-itinerary/index.ts`**

**Change 1a: Capture next leg transport_details on last-day-in-city** (~line 7423-7430)

When detecting the last day in a city, also capture the next city's `transport_details` (departure time, station, carrier) into a new variable `resolvedNextLegTransportDetails`:

```typescript
if (n === cityNights - 1) {
  resolvedIsLastDayInCity = true;
  const nextCity = tripCities.find((c: any) => c.city_order === city.city_order + 1);
  if (nextCity) {
    const isSameCountry = nextCity.country === city.country;
    resolvedNextLegTransport = (nextCity as any).transport_type || (isSameCountry ? 'train' : 'flight');
    resolvedNextLegCity = nextCity.city_name || '';
    // NEW: Capture transport details for departure-day prompt
    if ((nextCity as any).transport_details) {
      const raw = (nextCity as any).transport_details;
      resolvedNextLegTransportDetails = { ...raw };
      if (raw.operator && !raw.carrier) resolvedNextLegTransportDetails.carrier = raw.operator;
      if (!raw.duration && raw.inTransitDuration) resolvedNextLegTransportDetails.duration = raw.inTransitDuration;
    }
  }
}
```

**Change 1b: Gate departure prompt on actual transport mode** (~line 8193-8460)

For `resolvedIsLastDayInCity && !isLastDay`, check `resolvedNextLegTransport` **before** checking `hasReturnFlight`. If the next leg is non-flight, generate a train/bus/ferry departure prompt using the captured transport details (departure time, station, carrier) instead of airport logistics:

```typescript
} else if (isLastDay || resolvedIsLastDayInCity) {
  // NEW: For mid-trip city departures, use ACTUAL next-leg transport mode
  const isMidTripCityDeparture = resolvedIsLastDayInCity && !isLastDay;
  const isNonFlightDeparture = isMidTripCityDeparture && resolvedNextLegTransport && resolvedNextLegTransport !== 'flight';
  
  if (isNonFlightDeparture) {
    // Build departure prompt using train/bus/ferry details, NOT airport
    const td = resolvedNextLegTransportDetails || {};
    const modeLabel = resolvedNextLegTransport.charAt(0).toUpperCase() + resolvedNextLegTransport.slice(1);
    const depTime = td.departureTime || '10:30';
    const depStation = td.departureStation || `${modeLabel} Station`;
    const carrier = td.carrier || '';
    // ... build station-based departure prompt with checkout → transfer to station → board train
  } else {
    // Existing flight-based departure logic (hasReturnFlight check, etc.)
    ...
  }
}
```

The non-flight departure prompt should include:
- Hotel checkout (morning)
- Optional breakfast/farewell activity near hotel
- Transfer to train station (using real station name from transport_details)
- Board train (using real departure time, carrier from transport_details)
- No airport references whatsoever

**Change 1c: Same fix in full-trip path** (~line 1987-1997)

The `multiCityPrompt` for `isLastDayInCity` already says "next leg is TRAIN" but it's weak — the AI still sees flight data from `flightContext`. Add explicit instruction to **override** the prompt library's flight-based constraints:

```typescript
if (dayCity.isLastDayInCity) {
  // ... existing prompt ...
  if (isNonFlightFullGen) {
    multiCityPrompt += `\n   ⚠️ DO NOT mention airports, flights, or "Transfer to Airport". The next leg is by ${transportLabelFullGen}.`;
    // NEW: Override flight context for prompt library
    multiCityPrompt += `\n   ⚠️ IGNORE any flight departure data in the system prompt. This is NOT a flight departure day. Plan checkout → transfer to ${transportLabelFullGen.toLowerCase()} station → departure by ${transportLabelFullGen}.`;
    // Inject real transport schedule if available
    const nextTd = nextDayInfo?.transportDetails;
    if (nextTd?.departureTime) {
      multiCityPrompt += `\n   🚆 CONFIRMED ${transportLabelFullGen} SCHEDULE: Departs ${nextTd.departureTime}${nextTd.departureStation ? ` from ${nextTd.departureStation}` : ''}${nextTd.carrier ? ` (${nextTd.carrier})` : ''}. Plan checkout and transfer backwards from this time.`;
    }
  }
}
```

**Change 1d: Pass transport details through multiCityDayMap** (~line 1356-1420)

When building the `dayCityMap`, store the next city's transport details on the last day entry so the full-trip path can access them:

Add `transportDetails` to the `MultiCityDayInfo` interface and populate it on last-day-in-city entries.

**File 2: `supabase/functions/generate-itinerary/prompt-library.ts`**

**Change 2: Make `buildDayPrompt` aware of last-day-in-city**

Add an optional `isLastDayInCity` + `nextLegTransport` parameter to `buildDayPrompt`. When `isLastDayInCity && !isLastDay && nextLegTransport !== 'flight'`, call a new `buildCityDeparturePrompt` instead of `buildRegularDayPrompt` or `buildDepartureDayPrompt`. This ensures the prompt library never injects airport/flight references on non-flight departure days.

### Impact
- Last day in a city with train/bus/ferry next leg will generate station-based departure logistics
- Transport details (departure time, station, carrier) from step 2 will be injected into the departure prompt
- Airport stripping post-processing (line 10959) becomes a safety net rather than the primary fix
- No changes to the final day of the trip (actual return flight departure) — that path is untouched

### Files
- `supabase/functions/generate-itinerary/index.ts` — 4 changes: capture next-leg transport details, gate departure prompt on transport mode, strengthen multi-city prompt override, pass transport details through dayCityMap
- `supabase/functions/generate-itinerary/prompt-library.ts` — 1 change: add city-departure prompt variant

