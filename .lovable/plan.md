
# Systemic Timing Integrity — Pre-Customer Guard

## Problem (confirmed across trips, not just Milan)
Symptoms keep recurring: 9 AM → 12 PM → 6 AM jumps, post-checkout floating cards, stale `itinerary_activities` rows winning over healthy JSON, JSON not re-sorted after inserts/swaps. Today's fix healed Milan but the same class of bug will hit the next trip. We need a **single chokepoint** that no itinerary can bypass before a customer sees it.

## Strategy — defense at 3 layers, one canonical validator

Build one shared `validateChronology(days)` module that returns structured issues (`PREDAWN_NON_BOOKEND`, `BACKWARD_JUMP`, `POST_CHECKOUT_LEISURE`, `UNSORTED_BY_START`, `TABLE_JSON_DRIFT`, `NEXT_DAY_BLEED`). Wire it at three gates:

### Gate 1 — Write-time (server, hard block)
- `persistTripItinerary` (single boundary) runs `validateChronology` after `enforceTimingAndBuffers` + `normalizePredawnCascade` + `assertNoCrossDayBleed`.
- On any **critical** issue: auto-heal in place (re-sort by `dayChronoKey`, drop predawn non-bookend, prune post-checkout leisure via existing `pruneNonLogisticsAfterCheckout` / `enforceDepartureDayLogistics`), then re-validate.
- If still critical after heal → write proceeds BUT stamp `metadata.quality.chronology_blocked = {issues, at}` and emit `[CHRONOLOGY_BLOCKED]` sentinel + Sentry-style log. Never silently ship broken data.

### Gate 2 — Read-time (parser, last-mile scrub)
- `parseItineraryDays` runs the same validator after Step 4b ghost/bookend filter.
- Auto-applies the same in-memory heals (sort + predawn strip + post-checkout prune) so even legacy persisted trips render clean on next page load.
- Dispatches `voyance:chronology-healed` event → TripDetail lazily fires `safeUpdateItineraryData('self-heal-chronology')` (allowlisted in `frozen-guard.ts`) to persist the heal once.

### Gate 3 — Table-vs-JSON drift gate (rebuild guard)
- Today's `TripDetail` sparse-rebuild gate already penalizes broken timing. Promote it from "penalty score" to **hard reject**: if table-rebuild candidate fails `validateChronology` critically AND JSON passes, JSON wins unconditionally (no scoring tie-breaker).
- Add reverse heal: when JSON wins, enqueue `action-sync-tables` to rewrite `itinerary_activities` from canonical JSON so the drift can't re-poison the next reload.

## One-shot legacy backfill
Edge fn `heal-trip-chronology` (callable batch + lazy single-trip):
- Lists trips with `itinerary_status IN (ready, generated)` and `fully_persisted=true`.
- Runs validator; for any trip with critical issues, applies heals + re-persists via `safeUpdateItineraryData('self-heal-chronology-backfill', { allowFrozenWrite: true })`.
- Add allowlist entry in `frozen-guard.ts`.
- Lazy trigger in `TripDetail` mount (gated by `metadata.chronology_healed_at` stamp, runs once per trip, same pattern as today's `intents_backfilled_at`).

## Observability
- New SQL view `trips_with_chronology_issues` — counts blocked trips per day. We'll know **before** the customer does.
- Sentinels: `[CHRONOLOGY_VALIDATOR]`, `[CHRONOLOGY_BLOCKED]`, `[CHRONOLOGY_HEALED]` with issue counts.

## Files
- NEW `supabase/functions/_shared/chronology-validator.ts` + FE port `src/lib/itinerary/chronologyValidator.ts` (mirror, single source of rules).
- EDIT `supabase/functions/_shared/persist-itinerary.ts` (Gate 1 + auto-heal loop).
- EDIT `src/lib/itinerary/itineraryParser.ts` (Gate 2 + event dispatch).
- EDIT `src/pages/TripDetail.tsx` (Gate 2 listener + Gate 3 hard reject + backfill trigger).
- EDIT `supabase/functions/_shared/frozen-guard.ts` (allowlist `self-heal-chronology*`).
- NEW `supabase/functions/heal-trip-chronology/index.ts` (batch + single-trip).
- NEW migration: `trips_with_chronology_issues` view.
- Memory entry: `mem://constraints/itinerary/chronology-validator-three-gates`.

## Out of scope
UI changes, cost/budget logic, regeneration behavior, prompt edits. Pure post-write/pre-display integrity.

## Acceptance
- Any new trip with predawn non-bookend, backward jump, or post-checkout leisure is auto-healed before persist; if unhealable, write is stamped + logged (never silent).
- Page-load of any legacy trip with these issues self-heals in memory immediately + persists once.
- `trips_with_chronology_issues` view returns 0 critical rows after backfill.
- Milan `44a68e13` remains clean; spot-check 5 most recent trips show no chronology issues.
