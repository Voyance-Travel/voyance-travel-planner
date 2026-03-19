

## Fix: Budget Remaining showing -$expenses instead of correct remaining

### Root cause

The "Budget Remaining" card in `BudgetTab.tsx` reads `snapshot.budgetRemainingCents` from `useTripFinancialSnapshot`. That hook fetches `budget_total_cents` once on mount and only refetches on `booking-changed` events. However, when the user sets or updates their budget via the setup dialog, the `updateMutation` in `useTripBudget` invalidates react-query caches but does **not** dispatch `booking-changed`. So the snapshot's `budgetTotalCents` stays at 0 (or stale), producing:

```
remaining = 0 - tripTotalCents = -$2,160
```

Meanwhile the "Total Budget" card correctly shows $2,500 because it reads from `useTripBudget`'s settings (which uses react-query and is always fresh).

### Fix

**File: `src/hooks/useTripBudget.ts`** — Add `window.dispatchEvent(new CustomEvent('booking-changed'))` to the `updateMutation.onSuccess` handler so the financial snapshot refetches when budget settings change.

This is consistent with how other mutations in the codebase (delete entry, toggle hotel/flight inclusion) already dispatch `booking-changed`. The budget update is simply missing it.

One line addition, same pattern already used elsewhere in the file (line 147).

