## Plan: stop the permanent “Reconciling…” state

### Root cause
The Payments header total and the visible category buckets are still computed by separate logic paths:

- `useTripFinancialSnapshot` uses `resolveCanonicalCostRows()` to drop stale/orphan rows, skip walks, apply JSON rescue, apply inclusion toggles, add manual-payment deltas, and add the misc reserve.
- `PaymentsTab` / `usePayableItems` independently reconstruct bucket rows from a thinner `activity_costs` query and duplicated orphan-rescue logic.

When those paths disagree by more than $1, the UI waits 1.5s, then shows “Reconciling…”. Nothing actively resolves it, so any durable mismatch becomes a permanent badge.

### Implementation
1. **Use the canonical resolver inside Payments line items**
   - Replace the duplicated DB-row/orphan-rescue path in `usePayableItems` with `resolveCanonicalCostRows()`.
   - Use resolver output as the source for item rows and bucket totals.
   - Keep the existing grouped transit UI, manual expense rows, and hotel/flight selection handling.

2. **Pass complete cost row data to Payments**
   - Update the `activity_costs-payable` query in `PaymentsTab` to include the row fields required by the canonical resolver, especially `id`, `source`, `is_paid`, and `paid_amount_usd`.

3. **Make bucket reconciliation compare canonical-to-canonical**
   - Ensure visible category buckets are summed from the same canonical cents that feed the header snapshot.
   - Keep the misc reserve as its own visible row so the bucket total includes the same reserve as the header.

4. **Remove the permanent “processing” wording**
   - Replace “Reconciling…” with a finite diagnostic label like “Totals differ” if a durable mismatch still occurs.
   - Keep the hover title showing the exact bucket/header delta.
   - This avoids implying an async job is running when the UI is only displaying a mismatch.

5. **Add regression coverage**
   - Add/extend tests around the canonical resolver and `usePayableItems` for:
     - Venice-style activity totals matching the header.
     - $0 walking legs never counted.
     - misc reserve counted exactly once.
     - orphan/stale activity rows not creating bucket/header drift.

### Expected result
Payments will no longer get stuck in “Reconciling…”. The Payments visible buckets and Trip Total will either match because they use the same canonical cost rows, or show a clear finite mismatch label only if a true data inconsistency remains.