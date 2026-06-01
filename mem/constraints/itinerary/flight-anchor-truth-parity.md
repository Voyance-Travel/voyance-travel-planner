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
- single-day path: `action-generate-day.ts` (regenerate-day / Smart Finish /
  assistant rewrite_day) runs it on `generatedDay` after must-do backfill +
  transition-day injection, before the pipeline validate/repair block. Without
  this, the integrity contract correctly detected `FLIGHT_ANCHOR_COMMIT_MISMATCH`
  and demoted the trip to `partial`, but nothing ever overwrote the LLM's
  arrival time — the alarm rang but the fire was never put out.
- commit-gate self-heal: `_shared/commit-itinerary.ts::resolveCommitGate`
  detects `FLIGHT_ANCHOR_COMMIT_MISMATCH`, runs the stamper on `days[0]`,
  re-runs the integrity contract once. If the mismatch clears, the trip
  ships `ready` with `metadata.integrity_contract.repaired_codes:
  ['FLIGHT_ANCHOR_COMMIT_MISMATCH']`. Otherwise it still demotes to
  `partial` (no behaviour regression).

Sentinel: `[STAMP_ARRIVAL_TRUTH] v2|trip-day|action-generate-day day=N was=… now=… (truth=HH:MM)`
and `[COMMIT_GATE] … self-heal FLIGHT_ANCHOR_COMMIT_MISMATCH`.

Tests: `_shared/__tests__/stamp-arrival-anchor-truth.test.ts` (6 cases).

## Layer 6 (added 2026-06-01): Airport Transfer Duration Parity

The chain generator (`action-generate-trip-day.ts`) now also threads
`airportTransferMinutes` into `repairDay({...})` — computed via
`getAirportTransferMinutes(supabase, destination)` for Day 1 and transition
days. Previously only `action-generate-day.ts` (standalone path) carried the
destination-specific value; the chain path fell back to a generic 45-min
default. With both paths threading the real value, `repair-day.ts` §3b
reconciles any LLM-emitted airport→hotel transit card (e.g. "Walk to The
Shelbourne · 2hr 33min") to the authoritative duration (e.g. 30 min for
Dublin DUB). Closes the recurring inflated airport→hotel walk leak on the
chain path. Sentinel: `[Repair §3b] Reconciled LLM airport→hotel transfer …`.

## Layer 7 (added 2026-06-01): Departure Anchor Truth Stamper

Mirror of Layer 5 (arrival stamper) for the LAST day. Shared module
`_shared/stamp-departure-anchor-truth.ts` (`stampDepartureAnchorTruth`)
detects the departure-flight card via multi-signal lookup (`anchorSource`,
`tags`, `category ∈ {flight,transport,logistics}` + title regex matching
`departure|return|outbound|home flight`, `boarding flight`, or bare
"Flight" on a last-day flight card), then overwrites
`startTime = departureTime24 − boardingLeadMins` (default 45) and
`endTime = departureTime24`. Stamps `isLocked=true`,
`lockReason='flight-truth'`, `anchorSource='departure-flight'`,
`source='stamp-departure-truth'`. Idempotent.

**3 wiring sites** (mirror of arrival stamper sites, gated on
`isLastDay && returnDepartureTime24`):
- `action-generate-trip-day.ts` (~line 1672, immediately after the arrival
  stamp block).
- `action-generate-day.ts` (~line 1023, immediately after the arrival
  stamp block).
- `v2/generate-trip-day-v2.ts` (~line 220, alongside the v2 arrival stamp).

**Closes** the recurring "Departure Flight 01:35 AM ghost on last day"
pattern (e.g. Dublin trip `ab83230a-da60-47f1-94bf-61c11002d183` Day 4
where the LLM emitted a pre-dawn departure card with a real 21:00 PM
return flight). The 01:35 ghost starved meal repair because §9 saw a
"flight at the start of the day" anchor and refused to inject breakfast /
lunch / pre-departure dinner into the remaining window. Once the card
moves to 20:15→21:00, the day frees up `checkout 7AM → 14h open → transfer
~17:00 → flight 21:00` and existing meal-injection logic fills all 3
meals unaided.

Sentinel: `[STAMP_DEPARTURE_TRUTH] v2|trip-day|action-generate-day day=N was=… now=… (truth=HH:MM)`

Tests: `_shared/__tests__/stamp-departure-anchor-truth.test.ts` (6 cases —
no-op gating, overwrite, idempotency, detector signals).

---

## Layer 8 — Orphan-Transit Late Repair (repair-day §8e)

The integrity contract emits `FINAL_ORPHAN_TRANSIT` when a transit card
"Walk/Taxi/Tram/.../Transfer to <X>" has no same-day non-logistics activity
whose title or venue contains `<X>`. The validate-day twin
(`ORPHANED_TRANSIT_NODE` → repair-day §1b) only **removes**, and runs *before*
the §7/§8/§8b/§8c/§8d injection steps add new targets.

**`supabase/functions/generate-itinerary/pipeline/repair-day.ts` §8e** is the
late post-injection net. It scans the final per-day shape and for each
unlocked transit card whose target isn't already on the schedule:

- **Repoint** (preferred) when the next non-logistics, non-bookend activity
  starts within ±90 min of the transit's end. Rewrites `title` / `name` /
  `transportation.to` / `location.name` to the next activity's venue,
  stamps `metadata.transit_unverified=true` and `source='repair-orphan-repoint'`
  so geometry-based `recomputeTransitCards` and the FE health panel know
  the LLM-emitted duration is suspect.
- **Remove** when no next activity exists, the transit resolves to a
  hotel/airport bookend target, or the next activity sits >90 min later
  with no gap-filler.
- **Exempts** locked / user-pinned / manual / extracted rows, bookend-ish
  sources (`bookend-*`, `late_nightlife_bookend`, hotel/rest tags,
  `transportation.kind ∈ {departure, airport_transfer, flight_transfer}`),
  and hotel/airport/station-targeted titles.

After any repoint, §8e re-invokes `recomputeTransitCards` so the corrected
destination name flows into the geometry recompute and durations self-heal
when coords exist on the new target — no airport-only special case.

Sentinel: `[ORPHAN_TRANSIT_REPAIR] day=N idx=i action=repoint|remove before="…" after="…"`
Repair codes: `FINAL_ORPHAN_TRANSIT` with `action ∈ {repointed_orphan_transit, removed_orphan_transit_no_target}`.

**Closes** the recurring "Taxi to The Shelbourne — 1 hr" orphan class
(Dublin trip `ab83230a-…` Day 1 had a 60-min taxi to a hotel that wasn't
on the schedule; the integrity contract flagged it, but no repair pass
consumed `FINAL_ORPHAN_TRANSIT`, so it shipped as a draft violation).

Tests: `generate-itinerary/__tests__/orphan-transit-repoint.test.ts` (6 cases —
repoint, remove-no-target, hotel/airport exempt, matched-target no-op,
locked exempt, next-too-far removal).


