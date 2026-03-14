

## Bug: "Paid so far" never updates — ID mismatch

### Root Cause

The PaymentsTab builds item IDs as **composite keys**: `${activity.id}_d${day.dayNumber}` (e.g., `nola-d1-a1_d1`). When you click "Mark Paid", it passes this composite ID to `markActivityPaid()`.

But `activity_costs` stores plain IDs like `nola-d1-a1` — no `_d1` suffix.

So `markActivityPaid` runs:
```sql
UPDATE activity_costs SET is_paid = true WHERE activity_id = 'nola-d1-a1_d1'
```
This matches **zero rows**. The `is_paid` flag never gets set, `v_payments_summary` never sees paid amounts, and "Paid so far" stays at $0.00.

### Fix

**File: `src/components/itinerary/PaymentsTab.tsx`** — In `handleMarkAsPaid()` (line 509), strip the `_dN` suffix before calling `markActivityPaid`:

```typescript
// Strip composite suffix to get the real activity_id stored in activity_costs
const realActivityId = markPaidModal.id.replace(/_d\d+$/, '');
await markActivityPaid(tripId, realActivityId, markPaidModal.amountCents / 100);
```

Same fix needed in `handleUnmarkPaid()` — strip the suffix before resetting `is_paid`.

### Files to modify

| File | Change |
|------|--------|
| `src/components/itinerary/PaymentsTab.tsx` | Strip `_dN` suffix from item ID before calling `markActivityPaid` and the unmark equivalent |

