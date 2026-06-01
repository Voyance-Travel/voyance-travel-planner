---
name: Flight Anchor Truth Parity
description: Edge picker uses the same normalizer as FE; flight-hotel-context cross-checks picker vs flight_intelligence vs flat field; Executioner re-verifies truth at run time
type: constraint
---

The destination-arrival leg the prompt + Executioner trust MUST match the
leg the user saw in the FE editor. Four layers guarantee parity:

**`destinationIata` MUST be threaded into `autoTagLegs` on both sides.** Edge
callers (`normalize-flight-selection.ts`, `flight-leg-pick.ts`,
`flight-hotel-context.ts`, `action-generate-trip-day.ts`,
`action-generate-day.ts`, `schedule-executioner.ts`) and FE callers
(`src/utils/normalizeFlightSelection.ts`, `TripDetail.tsx`,
`EditorialItinerary.tsx`) accept an optional `{ destinationIata }` opt and
forward it. Without it, 2-leg connecting flights (ATL→JFK→DUB stored as
`legs[]` where leg 0 ends at the connector) get leg 0 wrongly tagged as
destination arrival, corrupting Day 1 anchor and every downstream schedule
rule. When `destinationIata` is missing on a multi-leg shape, the tagger
emits `[FLIGHT_TAG_NO_IATA] legs=N arr=I dep=J` so the upstream caller
omission surfaces in logs.



1. **`supabase/functions/_shared/normalize-flight-selection.ts`** is a
   Deno port of `src/utils/normalizeFlightSelection.ts` — same legs/legacy/
   flat detection, same `autoTagLegs` inference when `isDestinationArrival`
   is missing, same `estimateReturnArrival` back-fill for round-trips with
   no return-leg arrival time.

2. **`supabase/functions/_shared/flight-leg-pick.ts`** is now a thin wrapper
   around that normalizer. `pickDestinationArrivalLeg` /
   `pickDestinationDepartureLeg` return the SAME leg `getDestinationArrivalLeg`
   / `getDestinationDepartureLeg` (FE) return. `source` strings now describe
   how the marker was resolved (`isDestinationArrival_flag` /
   `autotag_two_leg_outbound` / etc.).

3. **`flight-hotel-context.ts`** cross-checks the picker's arrival against
   `flight_intelligence.destinationSchedule[0].arrivalDatetime` and the
   flat-shape `arrivalTime` field. If any two disagree by >30m it logs
   `[FLIGHT_TRUTH_DISAGREE] candidates=… chose=…` so picker bugs surface
   in logs instead of silently shipping. Precedence:
   `flight_intelligence > picker > flat`. flight_intelligence still
   overrides in the existing block below.

4. **`schedule-executioner.ts::enforceFlightAnchors`** accepts
   `ctx.rawFlightSelection` and re-picks via `_repickArrivalTruth`. If the
   freshly-picked truth disagrees with `ctx.arrivalTime24` by >10m it logs
   `[EXECUTIONER] EXEC_FLIGHT_TRUTH_DRIFT` and trusts the picker. Both
   `action-generate-trip-day.ts` and `action-generate-day.ts` thread the
   raw `flight_selection` into `execCtx.rawFlightSelection` for Day 1.

## Closes

Amsterdam pattern: 2-leg round-trip stored as `legs[]` WITHOUT
`isDestinationArrival` flag → picker returned `legs[0].arrival.time` only
because of the legacy fallback heuristic (which sometimes matched, sometimes
not). With autoTagLegs running on the edge, leg 0 is now deterministically
marked + picked, so `arrivalTime24=22:00` instead of `20:00`.

## Tests

- `supabase/functions/_shared/__tests__/flight-leg-pick.parity.test.ts` —
  all four shapes (legs+flags, legs-without-flags, legacy, flat) + return-
  arrival back-fill.
- Existing `integrity-contract.amsterdam.test.ts` still locks the
  `FLIGHT_ANCHOR_COMMIT_MISMATCH` integrity gate when the persisted card
  diverges from the picked truth.

## Sentinels

- `[FLIGHT_TRUTH_DISAGREE]` — cross-source disagreement at ingestion
- `[EXECUTIONER] EXEC_FLIGHT_TRUTH_DRIFT` — ctx.arrivalTime24 corrupted upstream
- `[FlightContext] … truthSource=picker|flight_intelligence`

## Layer 5 (added 2026-06-01): Authoritative Stamper

`supabase/functions/_shared/stamp-arrival-anchor-truth.ts::stampArrivalAnchorTruth`
is the single owner of the Day-1 arrival card's `startTime`/`endTime`. Pure,
idempotent. Stamps `isLocked=true`, `lockReason='flight-truth'`,
`anchorSource='arrival-flight'`, `source='stamp-arrival-truth'`. Wired:

- v2 path: `generate-trip-day-v2.ts` runs it immediately after the LLM
  response, before `validate_day_pre_repair`.
- legacy chain path: `action-generate-trip-day.ts` runs it on `dayMinimal`
  before `validateDay`.
- commit-gate self-heal: `_shared/commit-itinerary.ts::resolveCommitGate`
  detects `FLIGHT_ANCHOR_COMMIT_MISMATCH`, runs the stamper on `days[0]`,
  re-runs the integrity contract once. If the mismatch clears, the trip
  ships `ready` with `metadata.integrity_contract.repaired_codes:
  ['FLIGHT_ANCHOR_COMMIT_MISMATCH']`. Otherwise it still demotes to
  `partial` (no behaviour regression).

Sentinel: `[STAMP_ARRIVAL_TRUTH] v2|trip-day day=N was=… now=… (truth=HH:MM)`
and `[COMMIT_GATE] … self-heal FLIGHT_ANCHOR_COMMIT_MISMATCH`.

Tests: `_shared/__tests__/stamp-arrival-anchor-truth.test.ts` (6 cases).
