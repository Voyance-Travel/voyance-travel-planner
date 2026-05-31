# Phase B ✅ SHIPPED + Phase C ✅ SHIPPED

Status:
- Phase B parity ports all wired into `generate-trip-day-v2.ts`, 6/6 tests green.
- Phase C detector→repair upgrades wired between enrich and executioner, 11/11 tests green.
- v2 still gated behind `trips.metadata.useV2Chain === true`.

Next: flip 2 internal trips, run parity diff vs v1, then Phase D cutover.

---

## Phase C — Detector→Repair Upgrades ✅ SHIPPED

New module `supabase/functions/generate-itinerary/v2/detector-repairs.ts`:
exposes `runDetectorRepairs(activities, dayNumber) → { activities, counters, unresolvedOverlaps }`.
Three deterministic passes in order:

1. **closingHoursAutoShift** — Drops cards scheduled outside venue hours
   (`startsAfterClose`, `endsAfterClose` with 15-min grace, `startsBeforeOpen`).
   Replaced inline with `needs_replacement: true` + `metadata.dropped_reason` +
   `metadata.original_title` + `metadata.venue_hours`. Locked / user / booked
   rows exempt. Runs first so the overlap pass doesn't waste shift budget on
   cards we're about to drop.

2. **overlapAutoShift** — Walks pairs (i-1, i). When `currStart < prevEnd`,
   pushes current forward in 15-min increments. Cap = 90 min cumulative
   day-wide shift; on breach or when the next card is locked/exempt, the
   overlap is appended to `unresolvedOverlaps[]` and surfaced at
   `metadata.quality.unresolved_overlaps`.

3. **transitSanityWiden** — Transit cards (`category=transit/transport/transfer/
   logistics` or title starting `walk/stroll/transfer/drive/taxi/metro/bus/
   train`) with duration <8 min get widened when EITHER prev↔next haversine
   sits in 200–1500 m OR `neighborhood` mismatches between prev and next.
   New duration = max(10, ceil(km × 12)). Stamps
   `metadata.transit_widened = { from_min, to_min, distance_m, reason }`.

Counters → `day.metadata.quality.v2_detector_repairs = { overlapsShifted,
overlapsUnresolved, closingDropped, transitWidened, totalShiftMin }`.
Sentinel: `[V2_DETECTOR_REPAIRS] day=N overlap=X unresolved=Y closing=Z transit=W shiftMin=M`.

Wiring in `generate-trip-day-v2.ts`: new stage `v2_detector_repairs` runs
inside `withStage` between `enrichAndValidateHours` (Section 6) and
`runScheduleExecutioner` (Section 6b). Failures are non-blocking.

Tests: `supabase/functions/generate-itinerary/v2/__tests__/detector-repairs.test.ts`
(11 cases — empty input, single overlap shift, 90-min cap with unresolved,
locked-next protection, closing-after / before / grace / locked-exempt,
transit haversine + neighborhood + below-threshold no-op, closing-before-overlap
ordering).

---

## Phase B — v2 Parity Ports ✅ SHIPPED

All 6 ports live; see git history for line-level details:
1. ledger-check mutating passes
2. Post-meal-guard + runStep8 retry
3. Post-injection enrichment for must-do stubs
4. scrubPhantomEventRefs + nuclear sweeps
5. Chain self-invoke
6. withStage trace instrumentation

---

## Verification (parity gate — user action)

1. Deno test suite must stay green ✅
2. Flip `metadata.useV2Chain = true` on 2 internal trips (3-day + 5-day,
   different destinations).
3. Compare v1 vs v2: must-do coverage, meal counts, hotel-return bookends,
   cost ledger parity, no cross-day bleed, no unresolved_overlaps > 0.
4. Health-score parity (±2 points acceptable).

## Files (Phase C)

**New:**
- `supabase/functions/generate-itinerary/v2/detector-repairs.ts`
- `supabase/functions/generate-itinerary/v2/__tests__/detector-repairs.test.ts`

**Modified:**
- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts` (+ import + Section 6a stage)
- `.lovable/plan.md`

## Out of scope (Phase D + E)
- Phase D: flip default `useV2Chain` after parity green; delete
  `action-generate-trip-day.ts` (4,780 lines) and `generation-core.ts` Stage 6 writer.
- Phase E: route Budget Coach + reconciling toast through `useDisplayedTripTotal`.
