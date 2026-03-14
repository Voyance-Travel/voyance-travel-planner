

## Fix: Expected Spend uses per-person costs but Budget is for all travelers

### Root Cause

The `syncItineraryToBudget` function stores activity costs from `cost.perPerson` (or `cost.amount` which is also typically per-person) directly into the `trip_budget_ledger` **without multiplying by the number of travelers**. The `trip_budget_summary` view then sums these per-person amounts as `planned_total_cents`.

Meanwhile, `budget_total_cents` is the **total budget for all travelers**. This creates a mismatch — Expected Spend appears roughly half of what it should be for a 2-person trip.

### Fix

**File: `src/services/tripBudgetService.ts`** — In `syncItineraryToBudget`, multiply the per-person cost by the traveler count before inserting into the ledger:

- Accept a `travelers` parameter (number of travelers on the trip)
- Change line 490 from:
  ```
  amount_cents: Math.round(costAmount * 100)
  ```
  to:
  ```
  amount_cents: Math.round(costAmount * 100) * travelers
  ```
- If `costAmount` came from `cost.total` (which already accounts for all travelers), skip the multiplication. Use a simple heuristic: if the cost object has a `.total` field, use it directly; otherwise multiply `.perPerson` or `.amount` by travelers.

**File: `src/hooks/useTripFinancialSnapshot.ts`** — No changes needed. It already reads from `trip_budget_summary` which sums ledger entries. Once the ledger stores total (not per-person) amounts, the numbers will be correct.

**Callers of `syncItineraryToBudget`** — Pass the trip's `travelers` count. Need to verify the call sites already have this info available.

### Specific Logic

```typescript
// Determine if this is already a total or per-person
const isTotal = typeof rawCost === 'object' && rawCost?.total != null;
const baseCents = Math.round(costAmount * 100);
const totalCents = isTotal ? baseCents : baseCents * travelers;

entries.push({
  ...
  amount_cents: totalCents,
  ...
});
```

### Files to update

| File | Change |
|------|--------|
| `src/services/tripBudgetService.ts` | Add `travelers` param to `syncItineraryToBudget`, multiply per-person costs |
| Call sites of `syncItineraryToBudget` | Pass travelers count |

