## Audit results vs uploaded plan

Verified against `origin/main` HEAD. Several Phase 0 "blockers" are already shipped; the architectural argument still holds but the LOC numbers are worse than the plan claims.

| Plan claim | Actual | Verdict |
|---|---|---|
| `action-generate-trip-day.ts` 3,476 lines | **4,780 lines** | Worse than stated |
| `action-generate-day.ts` 1,832 lines | 1,958 lines | ~accurate |
| `generation-core.ts` 3,146 lines, "deprecated" | 3,307 lines; **still live** — Stage 6 actively writes `activity_costs` from L3211 | Inaccurate — not deprecated |
| `repair-day.ts` 7,500 lines | 5,495 lines | Overstated |
| `generate-itinerary/` ~22,000 LOC | **53,514 LOC** incl. tests/subdirs | Plan's <3,000-LOC target is unrealistic |
| 4 entry-point actions | Confirmed: `generate-trip`, `generate-trip-day`, `generate-day`, `generate-full` (router L13-16, L321-333) | ✓ |
| 3 `activity_costs` write sites | Confirmed: `action-generate-trip-day.ts:4294`, `generation-core.ts:3211`, `sync-trip-cost-table/index.ts:75` | ✓ |
| `mustHaves` disconnect — generator ignores `metadata.mustHaves` | **FALSE** — `pipeline/compile-prompt.ts:713` already reads `metadata.mustHaves` via `buildMustHavesConstraintPrompt` | Stale — already wired |
| Hotel `pricePerNight` field doesn't exist | **FALSE** — `src/types/trip.ts:96`, `src/services/hotelAPI.ts:37`, `budgetLedgerSync.ts:211/233/244` all use it | Stale — already exists |
| `budget_include_hotel` defaults to `false` | **FALSE** — migration `20260125234510` has `DEFAULT true`; `tripBudgetService.ts:307` falls back to `true` | Stale (also contradicts the earlier Fix-2 framing in this thread) |
| TripHealthPanel per-pair gate present | Confirmed L274-285 | ✓ |
| `venue-hours-validator` wired into repair-day | Confirmed (`repair-day.ts:39` import) | ✓ |
| Transit-sanity check at `repair-day.ts:3758` | Exists but at different line (file grew); the L3758 region in current code is a gap-closer | Line refs stale, logic present |

**Implication:** Phase 0 of the uploaded plan is effectively complete. Phases 1, 4, 5, 6 are still worth doing. Phase 2/3 (parallel `generate-day-v2`) is the right shape but should be re-scoped because the bigger fish is `action-generate-trip-day.ts` (4,780 lines), not `action-generate-day.ts` (1,958 lines).

## Revised plan

### Phase A — Single source of truth: `TripFacts` (1-2 days)

New file `supabase/functions/_shared/trip-facts.ts`. Pure orchestration over existing resolvers (`loadTravelerProfile`, `getFlightHotelContext`, `compileDayFacts`, `deriveMealPolicy`, `mergePreferenceSources`). Shape mostly as in the uploaded plan, with two adjustments:

- `mustHaves` field unifies `metadata.mustHaves` + `trip_day_intents` + legacy `userIntents` via the existing `mergePreferenceSources` boundary (don't introduce a parallel bridge — re-use what's already canonical).
- Add `hotel.pricePerNightCents` populated from the existing `HotelSelection.pricePerNight` field.

Snapshot test against a known trip row. No callers wired yet.

### Phase B — `action-generate-trip-day-v2.ts` (3-4 days, the high-leverage phase) — **CORE STAGES WIRED**

Status: v2 wrapper at `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts` now composes:
`resolveTripFacts → compileDayFacts → compilePrompt → compileDaySchema → callAI → repairDay → applyValidationGate → scrubActivity (per-card) → enrichAndValidateHours → runScheduleExecutioner (per-day) → persistDay → assertNoCrossDayBleed → normalizePredawnCascade → applyAnchorsWin → assertMustDoCoverage + injectMissingMustDos → runBookendVerification → persistTripItinerary → writeActivityCostsFromItinerary`. Router check `shouldUseV2Chain` reads `trips.metadata.useV2Chain`; default still v1. Smoke tests passing (8/8 across Phase A + B).

**Not yet ported from v1** (gate for cutover; flag stays off until each lands):
- `ledger-check` mutating passes (vibe-clash dinner downgrade, repeat-already-done)
- Post-meal guard + `runStep8` retry (covered partially by bookend-verification)
- Post-injection anchor-enrichment + `description-fill` for must-do stubs
- Chain self-invoke (next-day kick + heartbeat polling)
- `withStage` trace-recorder instrumentation
- `scrubPhantomEventRefs` / nuclear cross-city + dining sweeps beyond per-card scrubActivity

Each remaining item is an existing module in `_shared/` or `pipeline/`; porting is wiring, not rewrite. Target: 2 internal trips green on v2 before flipping the default.


### Phase C — Detector → repair upgrades (1-2 days)

The three P0 detectors land inside `repairAndValidate` (existing `pipeline/repair-day.ts`, no new file):

1. **Overlap auto-shift** — after `enforceTimingAndBuffers`, per-pair detector. Shift B to `A.end + buffer` (cap 90 min cumulative/day). If shift would breach `facts.departure.latestLastActivityTime`, stamp `metadata.quality.unresolved_overlaps` instead of silently corrupting.
2. **Closing-hours auto-shift** — when `validateClosingHours` reports a violation, shift earlier; if shifting creates a new overlap, drop and stamp `needs_replacement`.
3. **Transit-sanity widen** — broaden the existing check (current location after file grew is around `repair-day.ts` 3,750-3,780 region) to fire on neighborhood-name mismatch in address strings, or haversine 200–1500 m with LLM-given duration < 8 min. Force min 15-min taxi tier.

Lands behind v2 only — no risk to the live path.

### Phase D — Cutover (0.5 day)

Frontend `generate-trip` action routes to v2. After 1 week clean on 10+ trips, delete:
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (4,780 lines)
- `generation-core.ts` Stage 6 `activity_costs` writer (becomes redundant)
- `action-generate-day.ts` swaps to v2-style thin wrapper in a follow-up

### Phase E — Single financial snapshot (deferred, separate fix)

`useDisplayedTripTotal` already exists and is the single source for the header strip + Payments tab (see `mem://constraints/finance/displayed-trip-total-single-source`). Re-scope to:

- Audit Budget Coach and the reconciling toast for any divergent computations; route them through `useDisplayedTripTotal`.
- No new `canonicalTripCost.ts` file needed — the hook already plays that role.

### What this plan does NOT do

- Does not touch the data model.
- Does not rewrite `repair-day.ts` or `pipeline/persist-day.ts` — both stay as black boxes.
- Does not introduce a parallel must-haves bridge or a new hotel-pricing schema (both already shipped).
- Does not commit to the "< 3,000 LOC" target — realistic post-cutover floor is ~10–12k LOC after deleting `action-generate-trip-day.ts` + `generation-core.ts` Stage 6.

## Technical notes

- Feature flag lives at router level (`supabase/functions/generate-itinerary/index.ts:333`) — read `metadata.useV2Chain` on the trip row, fall back to `false`.
- `TripFacts` is purely additive; no schema migration.
- All existing `__tests__/` keep passing because Phase A/B compose surviving helpers.
- Verification gate per phase: same 10 P0 checks the uploaded plan listed, plus byte-for-byte JSON parity test on 3 internal trips.

## Total time

~6–8 working days (vs the uploaded plan's 9–13), because Phase 0 is already done and Phase 2 collapses into Phase B.
