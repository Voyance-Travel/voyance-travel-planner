# Phase B Finish — v2 Parity Ports ✅ SHIPPED

Status: all 6 parity ports wired into `generate-trip-day-v2.ts`. Tests green (6/6). Still gated behind `trips.metadata.useV2Chain === true`. Next: flip 2 internal trips and run parity diff vs v1.

## Ports (in order of risk) — all complete



### 1. ledger-check mutating passes
Wire `ledgerCheck(days, ledgers)` into v2 after `repairDay`, before `scheduleExecutioner`. Highest risk — handles vibe-clash dinner downgrades and repeat-already-done (with meal exemption per Core memory). Reuse existing `supabase/functions/generate-itinerary/ledger-check.ts` as-is; just need to build the per-day ledger context from `tripFacts` + prior days.

### 2. Post-meal-guard + runStep8 retry
After `enforceRequiredMealsFinalGuard` fires, run:
- `fillAfterMealGuard` (existing helper) for description backfill on injected dining stubs
- `runStep8` retry to add hotel-return bookend if meal guard pushed dinner late
Sentinel `hotel_return_post_meal_guard` per existing contract.

### 3. Post-injection enrichment for must-do stubs
After `injectMissingMustDos`, call `enrichDay` again scoped to newly-injected rows (they enter with `needsAnchorEnrichment:true`) + `fillMissingDescriptions` for any blank descriptions.

### 4. scrubPhantomEventRefs + nuclear sweeps
Add to per-card validation loop (already runs `scrubActivity`):
- `scrubPhantomEventRefs` (clause-level phantom-ref strip)
- `nuclearCrossCitySweep` + `nuclearDiningStrip` + `nuclearWellnessSweep` in terminalCleanup-equivalent stage

### 5. Chain self-invoke
After successful persist of day N, if N < tripDays:
- Fire-and-forget `EdgeRuntime.waitUntil` invoke of next day via `supabase.functions.invoke('generate-itinerary', { body: { action: 'generate-trip-day', tripId, dayNumber: N+1 } })`
- Emit launcher phase markers per `mem://constraints/observability/launcher-phase-markers`
- Heartbeat-aware: respect cancel flag in `trips.metadata.generation_cancelled`

### 6. withStage trace instrumentation
Wrap every pipeline stage in `withStage(trace, name, {dayNumber, inputs}, ctx => …)` using canonical names from `mem://constraints/observability/unified-generation-trace`. Trace persisted to `metadata.quality.generation_trace`.

## Tests
Extend `v2/__tests__/generate-trip-day-v2.test.ts`:
- ledger-check vibe-clash mutation flows through v2
- chain self-invoke fires for N<tripDays, suppressed when cancelled
- trace recorder captures all canonical stage names
- meal-guard → post-fill chain produces non-empty dining descriptions

## Verification (parity gate)
1. Run full deno test suite — must stay green
2. Flip `metadata.useV2Chain=true` on 2 internal trips (3-day + 5-day, different destinations)
3. Compare v1 vs v2 outputs: must-do coverage, meal counts, hotel-return bookends, cost ledger parity, no cross-day bleed
4. Health-score parity (±2 points acceptable)

## Files

**Modified:**
- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts` — wire all 6 ports
- `supabase/functions/generate-itinerary/v2/__tests__/generate-trip-day-v2.test.ts` — extend coverage
- `.lovable/plan.md` — mark Phase B complete

**No new files** — all helpers exist in `_shared/` or `generate-itinerary/`.

## Out of scope (next phases)
- Phase C detector→repair upgrades (overlap auto-shift, closing-hours, transit-sanity widen)
- Phase D cutover + v1 deletion
- Phase E financial snapshot audit

After parity green on 2 trips, ready for Phase C kickoff.
