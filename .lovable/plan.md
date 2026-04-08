

## Departure Day Timing: Transport-Aware Buffer

### The Problem

`enforceDepartureTiming()` in `flight-hotel-context.ts` hardcodes a 3-hour buffer (`departureMins - 180`) for all departure types. For a train departing at 12:43, this means nothing after 09:43 — but lunch was still injected at 12:30 because somewhere `depTime24` wasn't propagated, or the meal guard re-injected it afterward (same pattern as the breakfast-before-flight bug we just fixed).

The existing `enforceDepartureTiming` is called from `universalQualityPass` (Step 2) and should already catch this. Two possible failure modes: (a) `depTime24` is `undefined` because train departures aren't stored in `flight_selection` the same way flights are, or (b) the meal guard runs AFTER the quality pass and re-injects lunch (the same bug we just fixed for breakfast).

### The Fix (2 files)

#### 1. Make `enforceDepartureTiming` transport-aware (flight-hotel-context.ts)
Add an optional `transportType` parameter. Use 120 min buffer for trains, 180 min for flights (default).

```
enforceDepartureTiming(activities, departureTime24, transportType?: string)
  → buffer = transportType includes 'train' ? 120 : 180
```

#### 2. Pass transport type through the quality pass (action-generate-trip-day.ts + universal-quality-pass.ts)
- Extract the departure transport type from `flight_selection` (check `flightSel.return?.type`, `flightSel.returnTransportType`, or infer from title/category of departure activities)
- Add `departureTransportType?: string` to the quality pass options
- Forward it to `enforceDepartureTiming`

#### 3. Ensure meal guard respects departure buffer (already partially fixed)
In the previous fix, we passed `latestTimeMins` to the meal guard. Verify that `latestTimeMins` is computed from `depTime24 - buffer` and that the buffer accounts for train vs flight. If the meal guard's `latestTimeMins` doesn't match the departure filter, lunch can still be injected after the cutoff.

### Files Changed
1. `supabase/functions/generate-itinerary/flight-hotel-context.ts` — make `enforceDepartureTiming` accept transport type, use 2h buffer for trains
2. `supabase/functions/generate-itinerary/universal-quality-pass.ts` — pass `departureTransportType` to `enforceDepartureTiming`
3. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — extract and forward departure transport type from `flight_selection`

