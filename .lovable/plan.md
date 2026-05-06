# Fix: BudgetTab "Paid so far" lags PaymentsTab by activity-level payments

## Problem

BudgetTab's "Paid so far" reads `snapshot.paidCents` from `useTripFinancialSnapshot`, which already folds `trip_payments` rows in (lines 207–216) — so the divergence shouldn't exist. In practice the L'Arpège `$500` activity payment is missing from BudgetTab while PaymentsTab shows it.

Two contributors:

1. **Refetch race after Mark Paid.** `PaymentsTab.handleMarkPaid` inserts into `trip_payments` then immediately dispatches `booking-changed`. The snapshot handler runs `fetchData()` once, synchronously. In some sessions the read returns before the new row is visible (the same reason `fetchPayments(delayMs)` exists in PaymentsTab), so the snapshot keeps the pre-payment `paidCents` until the next unrelated refetch.
2. **No reconciliation guard.** The two surfaces never compare. When they disagree the user has no signal and we have no log.

## Goal

BudgetTab and PaymentsTab always agree on "Paid so far". When they don't, we self-heal and log instead of silently displaying two numbers.

## Changes

### 1. `src/hooks/useTripFinancialSnapshot.ts`
- On `booking-changed`, run `fetchData()` immediately AND schedule a second `fetchData()` after ~600 ms (mirrors PaymentsTab's `fetchPayments(delayMs)` pattern). Cancel any pending second pass on unmount.
- Accept an optional `optimisticPaidDeltaCents` on the `booking-changed` event detail. When present, apply it immediately to `data.paidCents` so the UI updates in the same frame Mark Paid is clicked, before the DB read returns.

### 2. `src/components/itinerary/PaymentsTab.tsx`
- In `handleMarkPaid` (and the bulk-pay path that dispatches `booking-changed`) include the just-paid amount in the event detail:
  `window.dispatchEvent(new CustomEvent('booking-changed', { detail: { optimisticPaidDeltaCents: amount } }))`.
- Same for `handleUnmarkPaid` with a negative delta.

### 3. Reconciliation log (defensive)
- In `useTripFinancialSnapshot.fetchData`, after computing `paidTotal`, compute `paidFromTripPaymentsOnly` (sum of `status='paid'` rows respecting include toggles, excluding the activity_costs.is_paid mirror entirely). If `paidFromTripPaymentsOnly > paidTotal` by more than a cent, prefer the higher value and `console.warn` with `tripId`. This guarantees BudgetTab can never under-report compared to the canonical PaymentsTab source.

### 4. Test
- Extend `src/hooks/__tests__/useTripFinancialSnapshot*.test.ts` (create if absent) with a fixture: 1 paid hotel manual payment + 1 paid activity payment for an activity_id no longer in `itinerary_data.days`. Assert `paidCents` equals the sum of both.

## Out of scope
- No schema changes; no edits to PaymentsTab's totals logic; no UI changes to the "Paid so far" line itself.
