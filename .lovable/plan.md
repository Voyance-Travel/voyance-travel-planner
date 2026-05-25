## Problem

The trip setup form only collects three flight times: outbound departure, outbound arrival (at destination), and return departure (from destination). It never asks for the return-flight arrival time back home. So `legs[1].arrival.time` is always empty, and `SortableFlightLegCards.tsx` line 188 falls through to `'--:--'`. This reproduces on Mexico City, Dubai, and any other trip set up through `ItineraryContextForm`.

## Fix

Compute the return arrival from the outbound flight duration at normalization time, since outbound has both departure and arrival times (so duration is known) and return-trips are almost always to the same airport.

### Changes

**1. `src/utils/normalizeFlightSelection.ts`**

Add a post-processing step inside the existing normalizer (after legs are built, before `autoTagLegs`):

- If exactly two legs exist, outbound (leg 1) has both `departure.time + departure.date` and `arrival.time + arrival.date`, and return (leg 2) has `departure.time + departure.date` but no `arrival.time`:
  - Parse outbound departure and arrival into UTC `Date` objects using the explicit `YYYY-MM-DD` + `HH:MM` builder pattern (avoid `new Date(str)` per the date-parsing guidance in context).
  - Compute `durationMinutes = (arrival - departure) / 60000`. Bail out if non-finite, negative, or > 20 h (sanity guard, prevents propagating a bad outbound).
  - Parse return departure the same way, add `durationMinutes`, and write back:
    - `legs[1].arrival.time` as `HH:MM`
    - `legs[1].arrival.date` as `YYYY-MM-DD` (may roll to next day for overnight returns)
    - `legs[1].arrival.estimated = true` (new optional boolean on the FlightLeg arrival shape)

- Add a tiny helper `estimateReturnArrival(outbound, returnLeg)` colocated in the same file and unit-test it.

**2. `src/utils/normalizeFlightSelection.ts` type**

Extend the leg's `arrival` shape with optional `estimated?: boolean` (already loose `Record`-style; just add to `FlightLeg.arrival`). Same update in `src/components/itinerary/SortableFlightLegCards.tsx` `arrival?:` prop type.

**3. `src/components/itinerary/SortableFlightLegCards.tsx`**

At the arrival cell (≈ line 188), when `leg.arrival?.estimated` is true, render a small muted "est." suffix under or beside the time so users know it was computed, not user-entered. Keep `--:--` fallback for the genuinely unknown case (e.g. one-way trip, malformed outbound).

**4. Tests**

Add `src/utils/__tests__/normalizeFlightSelection.estimateReturnArrival.test.ts` covering:
- ATL→MEX outbound 07:00 → 09:30, return MEX→ATL departs 13:00 → estimated arrival 17:30 same day (Mexico tz aside — we use raw times since dates are stored without tz, matching the rest of the codebase).
- Overnight return where departure + duration crosses midnight → arrival.date increments.
- Outbound missing arrival time → no estimation, return arrival stays empty.
- Negative/insane outbound duration → bail, no write.
- Three-or-more leg itinerary → skip estimation (only the two-leg legacy/auto case).
- Idempotency: running the normalizer twice does not double-shift.

## Out of scope

- Backend flight-card rendering (the Itinerary Day-1/Day-N flight blocks). If they show `--:--` too, a follow-up can apply the same helper server-side; but the user's report is the flight-card grid in setup, which this fixes.
- Adding a user-facing "return arrival" input. Not asked for; the estimate covers the same-airport round-trip case that ~all bookings here hit.

## Verification

After build:
1. Open a trip with two-leg flights and outbound arrival populated. Return arrival now shows the computed time with `est.` label, no more `--:--`.
2. Hard-refresh: estimate is recomputed at normalize time, so it survives reloads without needing a DB migration.
3. Unit tests above pass.
