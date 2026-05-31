# Phase D ✅ SHIPPED (Cutover, kill-switch active)

Status:
- v2 is now the **DEFAULT** generation chain for all trips.
- Kill-switch: set `trips.metadata.useV1Chain = true` to force legacy v1
  handler for emergency rollback. Scheduled for deletion in Phase E after
  a 1-week soak.
- Router fails OPEN to v2 on metadata read errors (cutover default).
- All 6 v2 router tests green.

---

## Phase D — Cutover ✅ SHIPPED

**`supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts`**
- `shouldUseV2Chain()` flipped: default `true`. Returns `false` only when
  `metadata.useV1Chain === true` (boolean strict) or `tripId` is empty.
- Errors during metadata read fail OPEN to v2.

**`supabase/functions/generate-itinerary/index.ts`**
- Router log copy updated to call out kill-switch path explicitly.

**Tests updated (`v2/__tests__/generate-trip-day-v2.test.ts`)** — 6/6 green:
- defaults to TRUE post-cutover
- `useV1Chain=true` boolean strict → routes to v1
- `useV1Chain='true'`/`1` (non-boolean) → still v2
- empty tripId → false (defensive)
- input validation contracts (unchanged)

## Soak plan (next 7 days)

1. Monitor `[generate-itinerary] Kill-switch active` log frequency — should
   be 0 unless a trip is manually flagged.
2. Watch `[V2_DETECTOR_REPAIRS]` / `[EXECUTIONER_SUMMARY]` counters across
   generations for unresolved overlaps or geo drops.
3. Compare health-score distribution week-over-week (±2 points acceptable).
4. If a regression class surfaces, flip affected trip's `useV1Chain=true`
   from the DB, file an issue, and continue soak on the rest.

## Phase E (queued, NOT shipped)

- Delete `action-generate-trip-day.ts` (4,780 lines) once soak is clean.
- Delete `generation-core.ts` Stage 6 writer.
- Delete `shouldUseV2Chain` flag plumbing + router branch.
- Wire Budget Coach + reconciling toast through `useDisplayedTripTotal`.

## Files (Phase D)

**Modified:**
- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts`
- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/generate-itinerary/v2/__tests__/generate-trip-day-v2.test.ts`
- `.lovable/plan.md`

---

## Phase C — Detector→Repair Upgrades ✅ SHIPPED

`v2/detector-repairs.ts` — closingHoursAutoShift / overlapAutoShift /
transitSanityWiden. Counters at `metadata.quality.v2_detector_repairs`.
11/11 tests green.

## Phase B — v2 Parity Ports ✅ SHIPPED

ledger-check / post-meal-guard runStep8 retry / post-injection enrichment /
scrubPhantomEventRefs + nuclear sweeps / chain self-invoke / withStage
trace instrumentation. 6/6 tests green.
