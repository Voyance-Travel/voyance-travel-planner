# Phase E (partial) ✅ SHIPPED — Displayed-Total Single Source

Cleanup deferred: v1 handler (~4,780 lines) + Stage 6 writer kept alive
during soak window. This phase unified the header/Payments/Budget
displayed-total math behind one composer.

---

## What shipped (2026-05-31)

**`src/hooks/useDisplayedTripTotal.ts`** — refactored
- Extracted pure `composeDisplayedTripTotal(snapshot, breakdown, dayNumbers?)`
  composer. Hook is now a thin shell around it.
- Consumers that already hold a snapshot+breakdown pair (e.g.
  EditorialItinerary header — needs the breakdown for per-day panels)
  can call the composer directly to avoid a duplicate fetch while
  keeping byte-identical output.

**`src/components/itinerary/EditorialItinerary.tsx`**
- Header `headerStripValues` now sourced from
  `composeDisplayedTripTotal(financialSnapshot, tripDayBreakdown, days.map(d=>d.dayNumber))`
  instead of an inline `computeHeaderStripValues({...})` call.
- Reuses existing snapshot + breakdown instances → zero extra network.
- Dropped the now-unused `computeHeaderStripValues` import.
- Reconciling hint predicate (`snapshotUnderChips || snapshotOverChips`)
  still reads from `headerStripValues` — but now `headerStripValues`
  comes from the shared composer, so the predicate matches PaymentsTab
  + BudgetTab exactly. No more drift class.

**`src/hooks/__tests__/useDisplayedTripTotal.parity.test.ts`** — new
6/6 green. Locks: Copenhagen clamp-up, snapshot-over flag, explicit
dayNumbers filter, default sum-of-days>0, loading propagation.

## Memory updated
- `Displayed Trip Total Single Source` entry — already documented the
  invariant; no change required (composer is the single source it
  already names).

## Phase E (still queued, NOT shipped)
- Delete `action-generate-trip-day.ts` (4,780 lines) once 7-day soak
  is clean.
- Delete `generation-core.ts` Stage 6 writer.
- Delete `shouldUseV2Chain` flag plumbing + router branch.

---

## Phase D ✅ SHIPPED (Cutover, kill-switch active)
v2 default-on; `metadata.useV1Chain=true` is the rollback switch.

## Phase C ✅ SHIPPED (Detector→Repair Upgrades)
`v2/detector-repairs.ts` — closingHoursAutoShift / overlapAutoShift /
transitSanityWiden. Counters at `metadata.quality.v2_detector_repairs`.

## Phase B ✅ SHIPPED (v2 Parity Ports)
ledger-check / post-meal-guard runStep8 retry / post-injection enrichment /
scrubPhantomEventRefs + nuclear sweeps / chain self-invoke / withStage
trace instrumentation.
