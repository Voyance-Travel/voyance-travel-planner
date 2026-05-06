# La Pergola Display vs Ledger Mismatch

## Root cause

Two distinct bugs are stacked:

1. **JSONB writeback is being clobbered post-repair.** `action-repair-costs.ts` correctly raised La Pergola to **$250/pp ($500 total)** in `activity_costs` AND wrote `{cost: {amount: 500}}` back into `trips.itinerary_data` (line 566). But `trips.updated_at` is **30 minutes after** the repair, while every `activity_costs.updated_at` is frozen at the repair time. Something — most likely an autosave path in `EditorialItinerary` / `TripDetail` that rewrites `itinerary_data` from in-memory React state — overwrote `cost.amount` back to the original AI-generated `$30`. The activity card then renders that stale `$30` (which displays as ~€26).

2. **The display layer trusts JSONB before the ledger.** `getDisplayCost` in `EditorialItinerary.tsx` reads `activity.cost?.amount` first (line 948). It never consults `activity_costs`, even though that table is declared the single source of truth ([Table-Driven Cost Architecture](mem://technical/finance/table-driven-cost-architecture)). So *any* drift in JSONB silently surfaces in the UI even though Budget/Payments are showing the correct $500.

The category over-allocation ($860 Food & Dining vs $360 budget) is the *correct* downstream consequence once the ledger has $500 for La Pergola + $240 for Imàgo. That's a separate "Luxury Luminary allocation %" calibration discussion — not a bug.

## Fix scope

Two surgical changes, no business-logic refactors.

### 1. Stop the JSONB clobber on autosave (root cause)

In every code path that writes `trips.itinerary_data` from in-memory React state, preserve `cost`/`estimatedCost` for activities that have a non-AI repair source recorded. Implementation:

- Stamp each repaired activity in JSONB with `cost.basis = 'repair_floor'` and `cost.source = 'michelin_floor' | 'reference_fallback' | 'auto_corrected'` during writeback in `action-repair-costs.ts`. (Already partially there — extend the patched object.)
- Add a small helper `preserveLedgerCosts(prevDays, nextDays)` in `src/utils/preserveLedgerCosts.ts`. For every activity in `nextDays`, if `prevDays` has the same id with `cost.basis === 'repair_floor'` (or matching `costSource`), force-keep the previous `cost` and `estimatedCost`.
- Apply that helper in the three autosave funnels that touch `itinerary_data` outside the repair pipeline:
  - `src/contexts/TripPlannerContext.tsx` (~line 289)
  - `src/pages/TripDetail.tsx` (~lines 1227, 1354, 1406, 1763, 1808)
  - `src/components/itinerary/EditorialItinerary.tsx` save funnels around line 1360 and 1470
- The helper is a no-op for activities without a ledger-protected basis, so manual/extracted/user-edited rows are untouched.

### 2. Defense-in-depth: display reads ledger when JSONB is suspiciously low

In `EditorialItinerary.tsx#getDisplayCost`:

- Accept the existing `activityCostsByActivity` map (already present in the file; consumed for per-day breakdown ~line 9683) and pass it down to the per-card cost resolver.
- Before returning `costAmount` from JSONB, compare to ledger: if `ledger.cost_per_person_usd > 0` AND `ledger.source` is in `{michelin_floor, ticketed_attraction_floor, auto_corrected, reference_fallback}` AND it is materially higher than JSONB (≥ 2×), prefer the ledger value and log once. This guarantees the card matches Payments/Budget even if a future code path forgets to preserve.

### 3. Backfill the existing trip

Run `repair-trip-costs` once for trip `a5f41a2b-…` so the JSONB writeback re-applies with the new `basis` stamp. (Server-side only; no migration.)

## Out of scope (explicitly)

- The "Luxury Luminary 30% dining allocation feels low" framing. That's an allocation-math conversation, not a bug; flagging via the existing [feasibility-warning-system](mem://features/budget/feasibility-warning-system) would be the right venue if we want to surface it.
- Any change to `michelin_floor` thresholds or the `KNOWN_FINE_DINING_STARS` map — La Pergola is correctly listed at 3 stars / $250 floor.

## Files touched

- `supabase/functions/generate-itinerary/action-repair-costs.ts` (stamp basis/source on JSONB writeback)
- `src/utils/preserveLedgerCosts.ts` (new)
- `src/contexts/TripPlannerContext.tsx`
- `src/pages/TripDetail.tsx`
- `src/components/itinerary/EditorialItinerary.tsx` (save funnels + getDisplayCost ledger fallback)
- `src/utils/__tests__/preserveLedgerCosts.test.ts` (new)

## Why this keeps happening

This is the third time we've seen "ledger correct, card wrong" (Paris hotel, Paris dining, Rome La Pergola). The pattern is always the same: a repair writes the truth, then a downstream autosave round-trips React state through `itinerary_data` and silently strips it. Step 1 closes the leak at the source; step 2 makes the UI honest even if a fourth funnel slips through later.
