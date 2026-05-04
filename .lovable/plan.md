# Fix: persistent "Reconciling…" badge on Payments tab

## Root cause

In `src/components/itinerary/PaymentsTab.tsx` (line ~898) the reconciliation badge compares:

```
Math.abs(payableTotalCents - financialSnapshot.tripTotalCents) <= 100
```

After the earlier override fix:
- `payableTotalCents` (from `usePayableItems`) now **suppresses** the canonical hotel/flight ledger rows whenever a matching manual override exists in `trip_payments`.
- `financialSnapshot.tripTotalCents` (from `useTripFinancialSnapshot`) still reads `activity_costs` directly and **includes** that canonical row.

So whenever the user has a manual hotel/flight expense, the two numbers intentionally differ by the canonical hotel/flight amount, and the badge stays in "Reconciling…" forever. There is no actual background recalculation — it's a stale comparison.

`estimatedTotal` (the displayed "Trip Total") is already correct: `baseTotal + override-aware manualExtraCents`. The badge just isn't using the same arithmetic.

## Fix

Make the badge compare two override-aware numbers. In `PaymentsTab.tsx` around line 896-907:

- Compute `rawManualCents` = sum of `amount_cents * quantity` for all `payments` whose `item_id` starts with `manual-`.
- Compute `clientTotal = payableTotalCents + rawManualCents` (this is the override-aware client view, since `payableTotalCents` already removed the suppressed canonical rows).
- Compare `clientTotal` against `estimatedTotal` (the displayed Trip Total) with the existing `<= 100` cents tolerance.
- Render "Matches itinerary" when within tolerance, "Reconciling…" only when truly drifting.

This keeps the badge meaningful (it will still flag genuine inconsistencies during a true background ledger sync) without producing a false positive every time a user adds a manual hotel/flight expense.

## Out of scope

- No change to `useTripFinancialSnapshot` or `usePayableItems` arithmetic — both are correct in their own contexts.
- No backend/edge-function changes; this is purely a UI badge logic fix.

## Acceptance

- Loading the Payments tab on a trip with a manual hotel override no longer leaves "Reconciling…" visible after the data is fetched; the green "Matches itinerary" check shows immediately.
- A trip with no manual overrides still shows "Matches itinerary" (no regression).
- If the snapshot and client-derived totals genuinely diverge (e.g. mid-write), "Reconciling…" still appears until they reconcile.
