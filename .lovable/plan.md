
## Goal

Confirm whether card prices and Budget tab line items still disagree on a fresh load of the Buenos Aires trip (`094d7ca4…`), and pinpoint *which* layer is lying — without changing any user-facing behavior yet.

## Why this comes first

The DB is internally consistent on every surface I can read server-side:

- `activity_costs` ledger, JSON `cost.amount`, JSON `cost.perPerson` — all agree row-for-row.
- The card render path in `EditorialItinerary.tsx` (L1003–1028) already short-circuits to `getLedgerOverride(activityId)` and returns `perPersonUsd` straight from the ledger, with a `warnOnceLedgerOverride` console warning if JSON ≠ ledger by ≥$1.
- The Budget tab reads from the same `useTripFinancialSnapshot` → `resolveCanonicalCostRows` → ledger pipeline.

So if a fresh hard-refresh still shows the mismatch you screenshotted ($35/pp bike, "Free" Caminito, $60 Lo de Jesús), one of three things is true and we don't yet know which:

1. **Card path drift** — `getLedgerOverride` returns nothing for those IDs (ledger map keyed by a different id shape than the JSON activity), so the card falls through to `costAmount`, `normalizedPrice`, or `estimateCostSync` and produces a different number than the ledger.
2. **Budget path drift** — the Budget tab groups/aggregates by category and applies a transform (e.g. dining bucket rolls up to $60 from a different row) that doesn't match what the card resolves to.
3. **Stale snapshot vs. fresh JSON** — `useTripFinancialSnapshot` returns a cached/orphaned row set that pre-dates the last persist, while the card reads the fresh JSON; OR vice versa.

Each has a different fix. We need a signal, not a guess.

## Plan

### 1. Add per-activity reconciliation logging (read-only)

In `src/components/itinerary/EditorialItinerary.tsx`, extend the existing `warnOnceLedgerOverride` block (L1014) to **always** emit a single structured `console.info('[CARD_PRICE_RESOLVE]', {...})` per activity per session, with:

```
{ tripId, activityId, title, day,
  ledger: { perPerson, total, source } | null,
  jsonCost: { amount, perPerson, basis, source },
  normalizedPriceFields: { price_per_person, estimated_price_per_person, price },
  estimateFallback: boolean,
  finalCardAmount: number,
  finalCardBasis: CostBasis }
```

Gate it behind `localStorage.VOYANCE_PRICE_DEBUG === '1'` so it only fires when we ask for it.

### 2. Add matching log in the Budget tab

In whichever component renders the per-item rows in the Budget tab (`BudgetTab.tsx` / `useTripFinancialSnapshot`), emit a parallel `[BUDGET_ROW_RESOLVE]` with `{ tripId, activityId, title, day, ledgerRow, displayedAmount, displayedBucket }`, behind the same flag.

### 3. Reproduce against the live Buenos Aires trip

You hard-refresh `/trip/094d7ca4-cd2c-4bd1-bad1-f0630874f8ba` with the flag on; paste the resulting `[CARD_PRICE_RESOLVE]` and `[BUDGET_ROW_RESOLVE]` lines for Urban Art Bike, Caminito, Arrival Flight, and the contested dinner. That tells us deterministically which path is producing each visible number.

### 4. Then fix the actual leak

Based on the logs, write the targeted patch in a follow-up plan (e.g. fix id-shape mismatch in `getLedgerOverride`, fix Budget bucket aggregation, force snapshot invalidation on `TRIP_PERSISTED_EVENT`, etc.). No speculative changes in this PR.

## Files touched (instrumentation only)

- `src/components/itinerary/EditorialItinerary.tsx` (extend the existing ledger-override warn block).
- `src/components/trip/BudgetTab.tsx` and/or `src/hooks/useTripFinancialSnapshot.ts` (one new console.info site).

## Not in scope

- No price logic changes, no migrations, no ledger backfill.
- Not touching the must-do coverage or flight-display work from the prior turns.

After you approve, I'll wire the instrumentation, you flip `localStorage.VOYANCE_PRICE_DEBUG='1'` and refresh, then paste the logs back here and we cut a targeted fix.
