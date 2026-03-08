

## Bug Fix: Payment Totals Not Updating After Mark as Paid

### Root Cause
The `canonicalSummary` (from `v_payments_summary` view) and `ledgerPlannedCents` (from `trip_budget_summary`) are fetched **once on mount** (lines 407-420) and never refetched after payment mutations. Since `paidAmount` and `progressPercent` derive from `canonicalSummary`, they stay stale when items are marked as paid.

### Fix

**File: `src/components/itinerary/PaymentsTab.tsx`**

1. **Extract the canonical summary fetch into a reusable callback** (like `fetchPayments` already is):
```tsx
const fetchSummary = useCallback(async () => {
  const [summary] = await Promise.all([
    getPaymentsSummary(tripId),
    supabase
      .from('trip_budget_summary')
      .select('planned_total_cents')
      .eq('trip_id', tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.planned_total_cents) {
          setLedgerPlannedCents(data.planned_total_cents);
        }
      }),
  ]);
  setCanonicalSummary(summary);
}, [tripId]);
```

2. **Replace the existing `useEffect` (lines 407-420)** to use `fetchSummary`:
```tsx
useEffect(() => { fetchSummary(); }, [fetchSummary]);
```

3. **Call `fetchSummary()` after every payment mutation** — in `handleMarkAsPaid`, `handleUnmarkPaid`, `handleAddExpense`, and `handleAssignMember`. Add it alongside the existing `fetchPayments()` calls:
   - Line 554: `fetchPayments(300)` → also add `fetchSummary()` after the delay or alongside it
   - Line 602: `await fetchPayments(150)` → also `await fetchSummary()`
   - Line ~628 (unmark): after `fetchPayments(200)` → also `fetchSummary()`
   - Line 764: `await fetchPayments(150)` → also `await fetchSummary()`

4. **Add optimistic `paidAmount` update in `handleMarkAsPaid`** for instant UI feedback: after adding the optimistic payment to `payments`, also update `canonicalSummary` optimistically:
```tsx
setCanonicalSummary(prev => prev ? {
  ...prev,
  total_paid_usd: (prev.total_paid_usd || 0) + markPaidModal.amountCents / 100,
} : null);
```

This ensures the percentage bar and paid total update immediately, with a background refetch to confirm.

