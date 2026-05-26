# Fix: Return flight arrival shows --:--

## Root cause

Two compounding bugs in `src/utils/normalizeFlightSelection.ts`:

1. **New-format early return skips the estimator.** The branch that handles `{ legs: [...] }` (which is what the setup form writes today, and what's persisted for all four affected trips — Dubai, Mexico City, Buenos Aires, Istanbul) returns immediately after mapping `legOrder`. It never calls `estimateReturnArrival` or `autoTagLegs`. Only the legacy `{ departure, return }` branch ran them. Verified by running the normalizer against the persisted `flight_selection` for `99c9d333…` (Dubai) and `3c2da103…` (Istanbul) — both come back with `legs[1].arrival.time = ""`.

2. **Estimator can't infer overnight outbound.** For Dubai the outbound is `dep 08:00 → arr 06:00` with no `arrival.date`. The estimator falls back to `departure.date` for both endpoints, computes a negative duration, and aborts — so even after fix #1 the Dubai return would still be blank. Buenos Aires (`08:00 → 09:00`) computes a bogus 1h duration for the same reason; it'd populate but with the wrong time.

## Fix

Frontend only. Single file: `src/utils/normalizeFlightSelection.ts`.

### 1. Hoist post-processing to a shared exit

Extract the `estimateReturnArrival(legs) → autoTagLegs(legs) → return wrapped` tail into a helper and call it from **both** the new-format branch and the legacy branch. Net effect: `legs[]`-shaped inputs go through the same enrichment as legacy-shaped inputs.

### 2. Infer overnight outbound in `estimateReturnArrival`

When the outbound's `arrival.date` is missing and the parsed arrival datetime is `≤` the departure datetime, treat the arrival as next-day before computing duration. Keep the existing `0 < durationMin ≤ 20h` sanity cap. Idempotent and bounded; matches how `getDestinationArrivalLeg` consumers already interpret a flight that "wraps past midnight".

### 3. Regression tests

Extend `src/utils/__tests__/normalizeFlightSelection.estimateReturnArrival.test.ts`:

- Dubai fixture (`08:00 → 06:00` outbound, no arr date) — return leg populates with `estimated: true`, arrival time ≈ `dep + (22h)`.
- Istanbul fixture (verbatim persisted payload, new-format `legs[]`) — return leg `arrival.time` = `17:00`, `estimated: true`.
- Mexico City fixture — return leg arrival populates.
- Buenos Aires fixture (`08:00 → 09:00`, no arr date) — return leg uses overnight inference (≈25h), not the bogus 1h.
- Idempotency: a second `normalizeFlightSelection` call on already-normalized output doesn't overwrite the populated time and keeps `estimated: true`.

## Out of scope

- No DB backfill needed: the normalizer runs at every read site (`EditorialItinerary.allFlightLegs`, `getDestinationArrivalLeg`, `getLastLegDepartureTime`). Once the helper runs in the new-format branch, all four affected trips display correctly on next render.
- No edge function / backend change. The persisted `flight_selection` shape stays as-is; estimated arrival is a display-time concern (consistent with the existing `estimated: true` marker the UI already renders as "est.").
- No change to `FlightSyncWarning`, anchor compare, cascade logic, or `buildFlightSelectionFromLegs`.

## Files

- **edited** `src/utils/normalizeFlightSelection.ts` — single shared exit + overnight inference.
- **edited** `src/utils/__tests__/normalizeFlightSelection.estimateReturnArrival.test.ts` — 4 fixture tests + idempotency.

After approval, I'll also update the existing memory entry `mem://constraints/itinerary/flight-display-normalize-and-anchor-compare` to note the new-format-branch coverage so this doesn't regress.
