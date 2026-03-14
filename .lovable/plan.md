

## Problem

When you click "Mark Paid" on PaymentsTab, it inserts a row into `trip_payments` but never updates `activity_costs.is_paid`. The financial snapshot ("Paid so far") reads from `v_payments_summary`, which only looks at `activity_costs.is_paid` — so it always shows $0.

The function `markActivityPaid()` already exists in `activityCostService.ts` and does exactly the right thing. It's just never called.

## Fix

**File: `src/components/itinerary/PaymentsTab.tsx`**

In `handleMarkAsPaid()`, after the `trip_payments` insert succeeds (line 504), add a call to `markActivityPaid`:

```typescript
import { markActivityPaid } from '@/services/activityCostService';

// After the trip_payments insert succeeds:
await markActivityPaid(tripId, markPaidModal.id, markPaidModal.amountCents / 100);
```

Similarly, in `handleUnmarkPaid()`, reset `is_paid` back to false on `activity_costs`.

This ensures `v_payments_summary.total_paid_usd` reflects the payment immediately, and `useTripFinancialSnapshot` picks it up on refetch.

**Additionally**, expose a `refetch` from `useTripFinancialSnapshot` so PaymentsTab can trigger an immediate refresh of the header totals after marking paid, rather than waiting for the next mount cycle.

### Files to modify

| File | Change |
|------|--------|
| `src/components/itinerary/PaymentsTab.tsx` | Call `markActivityPaid` / unmark after trip_payments write; trigger snapshot refetch |
| `src/hooks/useTripFinancialSnapshot.ts` | Export the `fetchData` function as `refetch` |

