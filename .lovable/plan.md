

## Fix: Budget Coach "Save $X" Shows Per-Person Instead of Group Total

### Problem
The Budget Coach displays "Save $70" but the actual budget impact is $140 (for 2 travelers). The savings label consistently shows half the real impact because the edge function receives and returns per-person costs, while the budget tracks group totals.

### Root Cause
In `BudgetCoach.tsx` line 142-143, `cost.amount` (per-person) is sent to the edge function. The edge function computes `savings = currentCostCents - newCostCents` — all per-person. But the budget display (`currentTotalCents`, `budgetTargetCents`) uses group totals. So the "Save" badge is in a different unit than the budget it claims to reduce.

### Fix (2 files, ~10 lines)

**1. Pass `travelers` into `BudgetCoach`**

- **`src/components/planner/budget/BudgetTab.tsx`** (~line 434): Add `travelers={travelers}` prop to `<BudgetCoach>`.

**2. Multiply displayed savings by travelers**

- **`src/components/planner/budget/BudgetCoach.tsx`**:
  - Add `travelers` to the props interface (default 1).
  - On the "Save" badge (line 428), display `formatCurrency(s.savings * travelers)` instead of `formatCurrency(s.savings)`.
  - On the current_cost and new_cost displays (lines 411, 418), also multiply by travelers so the price tags match the budget scope.
  - Add a `/pp` annotation when travelers > 1 for transparency, e.g. "Save $140 total" or show both.

This keeps the edge function unchanged (it still thinks in per-person, which is correct for the AI prompt). The UI layer simply scales to group totals for display, matching how the budget itself is tracked.

### Files
- `src/components/planner/budget/BudgetTab.tsx` — pass `travelers` prop
- `src/components/planner/budget/BudgetCoach.tsx` — accept `travelers`, multiply displayed costs/savings

