

## Bug: Budget Coach Uses Stale Ledger Data Instead of Real Expected Spend

### Root Cause

The Budget tab has **two separate financial data sources** that are out of sync:

1. **`useTripFinancialSnapshot`** → reads from `activity_costs` / `v_trip_total` view → shows **$1,285** (correct, used by Expected Spend card)
2. **`useTripBudget` → `getBudgetSummary`** → reads from `trip_budget_ledger` table → returns `totalCommittedCents + plannedTotalCents` which is **stale or zero**

The BudgetCoach receives `currentTotalCents={summary.totalCommittedCents + summary.plannedTotalCents}` (ledger-based), so it computes `gapCents = 0 - 100000 = negative` → `isOverBudget = false` → shows "On target" even though the real expected spend is $1,285 (129% of budget).

The same issue affects:
- **BudgetWarning banner** — uses `summary.status` which is derived from ledger-based `usedPercent`
- **`warningLevel`** in `useTripBudget` — also ledger-based

### Fix

**File: `src/components/planner/budget/BudgetTab.tsx`** (2 changes)

1. **BudgetCoach** (line 396): Replace `summary.totalCommittedCents + summary.plannedTotalCents` with `snapshot.tripTotalCents` — the canonical financial source of truth:
   ```tsx
   currentTotalCents={snapshot.tripTotalCents}
   ```

2. **BudgetWarning** (line 387-389): Override `summary.status` and `summary.usedPercent` with snapshot-derived values so the warning banner also triggers correctly:
   ```tsx
   <BudgetWarning summary={{
     ...summary,
     usedPercent: summary.budgetTotalCents > 0 
       ? (snapshot.tripTotalCents / summary.budgetTotalCents) * 100 
       : 0,
     status: calculateBudgetStatus(
       summary.budgetTotalCents > 0 
         ? (snapshot.tripTotalCents / summary.budgetTotalCents) * 100 
         : 0
     ),
   }} />
   ```

3. **`warningLevel` override** — Since `warningLevel` from `useTripBudget` is also ledger-based, compute a local override in BudgetTab using `snapshot.tripTotalCents` vs `settings.budget_total_cents` so the warning banner visibility condition is correct.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/planner/budget/BudgetTab.tsx` | Pass `snapshot.tripTotalCents` to BudgetCoach and override summary status for BudgetWarning using snapshot data |

