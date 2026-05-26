# Fix flight display bugs

Two small frontend display bugs in the itinerary header. Both are presentation-layer only; no backend/itinerary data changes.

## Bug 1 — Return flight arrival shows `--:--`

### Root cause
`EditorialItinerary.tsx` builds `allFlightLegs` (lines 3704-3719) by reading `flightSelection.legs` directly. It **bypasses** `normalizeFlightSelection()`, so the `estimateReturnArrival()` helper that fills in a missing return-arrival time from outbound duration never runs.

Confirmed in DB for Buenos Aires trip `094d7ca4…`: `legs[1].arrival.time = ""` — exactly what the user sees as `--:--`. The trip setup form does not collect a return arrival time, so the leg is always blank without estimation.

### Fix
Route `allFlightLegs` through `normalizeFlightSelection(flightSelection)` and read `.legs` from the result. The normalizer already:
- runs `estimateReturnArrival()` (outbound duration + return departure → return arrival, marked `estimated: true`)
- runs `autoTagLegs()` for destination flags
- handles both `legs[]` and legacy `{departure, return}` shapes

`SortableFlightLegCards` already renders an "est." pill when `arrival.estimated` is true (lines 190-192), so no UI change needed.

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — replace the `allFlightLegs` useMemo body with a single `normalizeFlightSelection(flightSelection)?.legs ?? []`, preserving the `seat/cabinClass` field-name normalization.

## Bug 2 — Day 1 "Flight times don't match your itinerary" false alarm

### Root cause
`FlightSyncWarning` (EditorialItinerary.tsx ~line 9753) compares `flightArrivalTime` (e.g. 15:00) against `day1FirstActivity.startTime`. When the first activity is the auto-injected Arrival Flight card (`repair-arrival-flight`, repair-day.ts:984), that card's `startTime` is `arrival − 120 min` (block start) and its `endTime` is the actual arrival time. So the comparison is "flight lands 15:00 vs activity at 13:00" — always misaligned by 2h, always triggers the amber banner, even on a freshly-generated itinerary where nothing is wrong.

### Fix
In `FlightSyncWarning`, when the first activity is the arrival-flight anchor (category `flight`/`transport` AND `anchorSource === 'arrival-flight'` OR title matches `arrival flight|landing`), compare `flightArrivalTime` against the activity's **`endTime`** (the landing moment) instead of `startTime`. For all other first-activity types, keep the existing `startTime` comparison.

Also tighten the alignment tolerance: treat ±5 min as aligned (unchanged), and skip the warning entirely if the card carries `anchorSource: 'arrival-flight'` AND its `endTime` equals flight arrival time (the deterministic cascade already keeps these in sync).

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — update `FlightSyncWarning` to pick the right time field based on whether the first activity is the arrival-flight anchor.

## Verification
- Buenos Aires trip: open header → return leg now shows estimated arrival (e.g. `15:00 est.`) instead of `--:--`.
- Rome / Mexico City / Buenos Aires: amber "Flight times don't match" banner no longer appears on freshly generated itineraries where the arrival-flight card's endTime matches the flight's arrival time. Banner still fires correctly if user later swaps in a real first activity that genuinely starts before flight arrival.

## Out of scope
No edge function changes. No itinerary data writes. No changes to `normalizeFlightSelection.ts` itself (already correct).
