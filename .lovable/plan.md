# Flight Anchor Truth: Edge ↔ FE Parity

## Root cause

`supabase/functions/_shared/flight-leg-pick.ts` is a partial port of `src/utils/normalizeFlightSelection.ts`. It diverges in three ways that all bias toward picking the wrong leg, then `flight-hotel-context.ts` commits that wrong value as `arrivalTime24` and the Executioner happily "repairs" the day against the wrong truth.

1. **No `autoTagLegs` fallback.** When `flight_selection.legs[]` exists but no leg carries `isDestinationArrival`, FE infers the marker (single → leg 0; 2-leg → leg 0; 3+ → leg N-2 / destIata match). The edge picker only checks `legs.find(l => l.isDestinationArrival)` — if the flag is missing it walks a different heuristic, and on round-trips that wrote `legs[]` without flags it can return the **return leg's** departure airport's arrival time.
2. **No `estimateReturnArrival`.** FE fills `legs[1].arrival.time` from outbound duration when the form didn't collect it. The edge picker doesn't, so multi-leg trips can have the picker fall back to a leg with a populated `arrival.time` that isn't the destination arrival.
3. **Legacy/flat branch reads `data.arrivalTime` blind.** For the `{ departure: {...}, return: {...} }` shape, the edge picker reads `dep?.arrival?.time` but for the `flat` shape it reads `data.arrivalTime` with zero validation. If the value is an ISO 8601 string with a TZ offset, `parseTimeToMinutes` (in `flight-hotel-context.ts`) only matches `HH:MM (AM|PM)?` and falls back via `normalizeTo24h`'s ISO regex — which does work — but the picker's `source` label hides that we ever consulted this branch, so the parseFailed instrumentation can't fire and no audit trail exists.

In the Amsterdam case the trip stored `legs[]` without `isDestinationArrival` flags, the picker returned the wrong leg's `arrival.time` (an earlier connection arrival around 20:00), `normalizeTo24h` happily produced `20:00`, `ARRIVAL_BUFFER_MINS = 4h` pushed `earliestFirstActivity` to a sane-looking 00:00, the LLM scheduled the "arrival flight" card around 20:00, and the Executioner had nothing to repair because `ctx.arrivalTime24 = 20:00` matched.

## Fix

### 1. Port FE normalization into the shared edge picker

Replace `flight-leg-pick.ts` `pickDestinationArrivalLeg` / `pickDestinationDepartureLeg` with calls that go through a Deno-port of `normalizeFlightSelection` (legs[] + legacy + flat → unified `legs[]`, then `autoTagLegs` + `estimateReturnArrival`). Both pickers then read the user-marked or auto-tagged leg only — no second heuristic.

New module: `supabase/functions/_shared/normalize-flight-selection.ts`. Mirrors `src/utils/normalizeFlightSelection.ts` exactly (legs/legacy/flat detection, `parseDateTimeUTC` accepting 24h + 12h, `estimateReturnArrival` for round-trips, `autoTagLegs` for missing markers).

`flight-leg-pick.ts` then becomes a thin wrapper that:
- normalizes,
- finds the `isDestinationArrival` (or `isDestinationDeparture`) leg,
- returns `{ shape, source, leg, rawArrivalString, rawDepartureString }` exactly like today (no signature change for `flight-hotel-context.ts`).

### 2. Add an arrival-truth sanity check before committing it

In `flight-hotel-context.ts` after computing `arrivalTime24`, cross-check against alternate sources and downgrade to `parseFailed = true` (soft fallback) when they disagree by more than 30 minutes:

- `flight_intelligence.destinationSchedule[0].arrivalDatetime` (already read further down) — pull this BEFORE picking, not after, and let it OVERRIDE the picker when present.
- `flight_selection.arrivalTime` flat-shape field (when present alongside legs[]).
- A new `rawUserEnteredArrival` audit field captured by the normalizer (the very first time `leg.arrival.time` was non-empty on the marked leg).

If any two sources disagree by >30m, log `[FLIGHT_TRUTH_DISAGREE]` with all candidates and choose the one matching `flight_intelligence` > marked leg > legacy `departure.arrival.time` > flat `arrivalTime`. Stamp the chosen source on the result so the Executioner can include it in `EXEC_FLIGHT_ANCHOR_FIXED` audit metadata.

### 3. Make the Executioner re-verify truth at run time

In `enforceFlightAnchors` (schedule-executioner.ts ~237), when `ctx.arrivalTime24` exists, also re-pull the raw `flight_selection` from `ctx` (already plumbed for hotel checks) and assert the picked arrival agrees with `ctx.arrivalTime24` within 10 minutes. If they disagree, log `EXEC_FLIGHT_TRUTH_DRIFT` and trust the freshly-normalized value (Executioner is the last gate before persist, so re-normalizing here closes the loop if any upstream stage corrupted `ctx`).

### 4. Tests

- `flight-leg-pick.parity.test.ts` (new): fixtures for all four shapes (legs+flags / legs-without-flags / legacy / flat), each asserting the BE picker returns the same leg as the FE `getDestinationArrivalLeg`. Includes the Amsterdam reproducer: 2-leg round-trip with no `isDestinationArrival` flag, arrival 22:00 → must return 22:00 not 20:00.
- Extend `integrity-contract.amsterdam.test.ts`: when raw `flight_selection.legs[]` says 22:00 but the persisted Day-1 arrival card says 20:00, the gate must catch `FLIGHT_ANCHOR_COMMIT_MISMATCH` (already does — confirm via fixture).
- New `flight-truth-disagree.test.ts`: feed `flight_selection` saying 20:00 and `flight_intelligence` saying 22:00 → `arrivalTime24` resolves to 22:00 + log line emitted.

## Files

- **New:** `supabase/functions/_shared/normalize-flight-selection.ts` (Deno port of FE module)
- **New:** `supabase/functions/_shared/__tests__/flight-leg-pick.parity.test.ts`
- **New:** `supabase/functions/_shared/__tests__/flight-truth-disagree.test.ts`
- **Edit:** `supabase/functions/_shared/flight-leg-pick.ts` (route through new normalizer)
- **Edit:** `supabase/functions/generate-itinerary/flight-hotel-context.ts` (cross-check + source stamp + early flight_intelligence read)
- **Edit:** `supabase/functions/_shared/schedule-executioner.ts` (`enforceFlightAnchors` re-verify)
- **Edit:** `mem/index.md` + `mem/constraints/itinerary/final-commit-gate.md` (record the new "Flight Truth Reconciliation" rule)

## Out of scope

- Changing the form/UI for entering flights. The fix is read-side only — existing trips with already-stored `legs[]` without flags will resolve correctly via `autoTagLegs`.
- Backfilling historical trips. The next regeneration / refresh pulls the corrected truth automatically; one-shot migration not needed.
