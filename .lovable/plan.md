## Problem

Budget tab "Paid so far" ($2,400) is $500 short of Payments tab "Paid so far" ($2,900). The missing $500 is a Lunch at L'Arpège that was marked paid in the Payments tab.

### Root cause

The two tabs derive "paid so far" from different sources:

- **Payments tab** (`PaymentsTab.tsx` → `getTripPayments` in `src/services/tripPaymentsAPI.ts:104-139`)
  Sums `trip_payments` rows where `status = 'paid'`. Authoritative — every "Mark paid" click writes a row here.

- **Budget tab** (`BudgetTab.tsx:904` → `snapshot.paidCents` from `useTripFinancialSnapshot.ts`)
  Sums:
  1. `activity_costs.paid_amount_usd` where `is_paid = true` (lines 167-170), plus
  2. `trip_payments` rows whose `item_id` matches `manual-%` only (lines 115-119, 178-184).

When the user marks "Lunch at L'Arpège" paid in the Payments tab, the handler:
1. Always inserts a `trip_payments` row with `status = 'paid'` ✅
2. Calls `markActivityPaid(tripId, activityId, amountUsd)` to mirror it onto `activity_costs.is_paid` (`PaymentsTab.tsx:419-422` → `activityCostService.ts:267-287`).

Step 2 silently no-ops whenever the L'Arpège payment row in `activity_costs` is missing or its `activity_id` doesn't match the itinerary id passed in (orphaned row, regenerated activity, composite `_dN` mismatch, manual entry, etc.). Result: Payments tab counts the $500 (from `trip_payments`); Budget tab doesn't (no `is_paid=true` row, and item_id isn't `manual-%`).

This is the same drift class as the recent "Reconciling…" bug; the snapshot must accept `trip_payments` as the authoritative source for "paid", just like Payments tab does, instead of trusting that the mirror succeeded.

## Fix

### 1. Make `useTripFinancialSnapshot` paid total match Payments tab

In `src/hooks/useTripFinancialSnapshot.ts`:

- Fetch **all** `trip_payments` rows for the trip (not just `like 'manual-%'`). Keep the manual filter for the existing manual-spend `totalCents` math, but use the full list for `paidTotal`.
- Compute `paidTotal` as:
  ```
  paidTotal = sum(trip_payments where status='paid')
            + sum(activity_costs.paid_amount_usd where is_paid AND no matching trip_payments row)
  ```
  Match key: `trip_payments.item_id` ↔ `activity_costs.activity_id` (with the `_d{N}` suffix stripped, mirroring `PaymentsTab.tsx:421`). The "no match" branch preserves any legacy/manual `is_paid` flips that were never written through the Payments tab.
- Apply the same hotel/flight inclusion gate (`includeHotel` / `includeFlight`) to `trip_payments` so toggling those off doesn't double-shrink or inflate the paid figure (mirror the row-level rule already in `shouldCountRow`).

This keeps the snapshot's `tripTotalCents` math untouched (only `paidCents` changes), and makes BudgetTab's "Paid so far" identical to PaymentsTab's `totals.paid`.

### 2. Backfill mirror best-effort but don't depend on it

In `src/components/itinerary/PaymentsTab.tsx` (handlers `handleMarkAsPaid` and `handleUnmarkPaid`), keep the `markActivityPaid` / `update is_paid=false` calls but treat them as a non-blocking mirror. Log (don't toast) when the mirror updates 0 rows so future regressions are visible in console without user-visible noise. Snapshot is now correct either way.

### 3. Tests

Add `src/hooks/__tests__/useTripFinancialSnapshot.test.ts` cases (or extend an existing test):
- Paid `trip_payment` exists with no matching `activity_costs.is_paid` → counted once.
- Both `trip_payment` paid AND `activity_costs.is_paid` for same item → counted once (no double count).
- Legacy `activity_costs.is_paid=true` with no `trip_payment` row → still counted.
- `manual-%` payment + canonical hotel row → existing override math unchanged.

### 4. QA
1. Mark L'Arpège paid from Payments tab → both tabs show $2,900 immediately.
2. Unmark → both tabs drop to $2,400.
3. Hotel toggle off in Budget settings → both tabs hide the $2,400 hotel row from "Paid so far" consistently.
4. Add a "Manual" expense from PaymentsTab → still folded in (manual-% path unchanged).
5. Existing optimistic UI in PaymentsTab still updates instantly; BudgetTab refreshes via the existing `'booking-changed'` event already dispatched after mark/unmark.

## Files touched
- `src/hooks/useTripFinancialSnapshot.ts` — broaden `trip_payments` fetch + new `paidTotal` reconciliation.
- `src/components/itinerary/PaymentsTab.tsx` — log silent mirror failures (small).
- `src/hooks/__tests__/useTripFinancialSnapshot.test.ts` — new tests.

No DB migrations, no edge functions, no schema changes.