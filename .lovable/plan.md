# Fix 1 of 4 — Flight Anchor Bug (S-1)

## Root cause (confirmed)

`autoTagLegs(legs, { destinationIata })` is documented to use the destination IATA as a tie-breaker for 3+ leg itineraries and as a sanity check on 2-leg ones. But **both** normalizers — edge and FE — call it with no options:

- `supabase/functions/_shared/normalize-flight-selection.ts:155` → `autoTagLegs(legs)`
- `src/utils/normalizeFlightSelection.ts:68` → `autoTagLegs(legs)`

The trip's destination IATA exists on the trip record (`destination_iata` and/or the arrival airport entered in Step 2) but never reaches the tagger. For any 2-leg or 3+ leg shape where the array order doesn't match the naive "leg 0 = outbound" assumption (connecting flights, legacy `{departure,return}` re-emitted as `legs[]`, AI-generated multi-segment trips), the wrong leg gets tagged `isDestinationArrival`. That wrong arrival time flows into the Day 1 prompt anchor and corrupts every downstream scheduling rule.

## Fix

Thread `destinationIata` through one call chain on each side, then pass it to `autoTagLegs`.

### Edge (primary)

1. **`supabase/functions/_shared/normalize-flight-selection.ts`**
   - Add optional second arg: `normalizeFlightSelection(raw, opts?: { destinationIata?: string | null })`.
   - Pass `opts?.destinationIata` into `finalize`, then into `autoTagLegs(legs, { destinationIata })`.

2. **`supabase/functions/_shared/flight-leg-pick.ts`**
   - Add optional second arg to `pickDestinationArrivalLeg` and `pickDestinationDepartureLeg`: `(raw, opts?: { destinationIata?: string | null })`.
   - Forward to `normalizeFlightSelection(raw, opts)`.

3. **`supabase/functions/generate-itinerary/flight-hotel-context.ts`** (line ~254)
   - Read `trip.destination_iata` (fall back to `trip.arrival_airport` / `flightRaw.arrivalAirport`).
   - Pass `{ destinationIata }` into both picker calls.

4. **`supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (line ~2858) — same threading for the diagnostic picks.

5. **`supabase/functions/_shared/schedule-executioner.ts`** (line ~40, `_repickArrivalTruth`) — accept and forward `destinationIata` from `ctx`. Both generators (`action-generate-trip-day.ts`, `action-generate-day.ts`) already pass `execCtx.rawFlightSelection`; add `execCtx.destinationIata` next to it.

### Frontend (parity)

6. **`src/utils/normalizeFlightSelection.ts`** — same optional-arg addition; forward into `autoTagLegs`. Update `getDestinationArrivalLeg`, `getDestinationDepartureLeg`, `getFirstLegArrivalTime`, `getLastLegDepartureTime` to accept and forward `opts`. Callers without IATA stay backward-compatible (parameter is optional).

7. **Callers that have trip context** — `src/pages/TripDetail.tsx:3889` and `src/components/itinerary/EditorialItinerary.tsx:3786` pass `{ destinationIata: trip.destination_iata ?? trip.arrival_airport }`. Other callers (FlightSyncWarning, etc.) can stay as-is until needed; the new arg is optional.

## Tests

- **New** `supabase/functions/_shared/__tests__/flight-leg-pick.destination-iata.test.ts`:
  - 2-leg trip where leg 0 arrives at a layover and leg 1 arrives at destination → with `destinationIata` set, leg 1 is tagged arrival (without IATA, leg 0 is wrongly tagged — locks the bug).
  - 3-leg ATL→JFK→CDG + CDG→ATL with `destinationIata:'CDG'` → leg 1 tagged arrival, leg 2 tagged departure (already covered in `autoTagFlightLegs.test.ts` for the FE helper — this asserts the edge pipeline now actually reaches that branch).
  - Regression: existing 2-leg "leg 0 already correct" case still picks leg 0 when IATA matches.
- Existing `flight-leg-pick.parity.test.ts` stays green (all current cases call without IATA → behavior unchanged for them).

## Memory

Update `mem/constraints/itinerary/flight-anchor-truth-parity.md` to document the IATA threading requirement and add a `[FLIGHT_TAG_NO_IATA]` warn log when `destinationIata` is missing but a multi-leg shape is being tagged.

## Out of scope (separate fixes, user acknowledged)

- `budget_include_hotel` default → `true` in Start.tsx
- Three-way payment total reconciliation (header / snapshot / breakdown)

These will be addressed in Fix 2 and Fix 3 after this lands.
