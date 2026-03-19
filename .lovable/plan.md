

## Fix: "Trending Over Budget" message misleading when under budget

### Problem

The yellow warning triggers at 85% budget usage (correct threshold), but the messaging is wrong:
1. **"Trending Over Budget"** — misleading when actually $341 under budget
2. **"-14% over"** — shows a negative number because it computes `usedPercent - 100` (86% - 100% = -14%)

The warning *should* appear at 85%+ to alert users they're approaching the limit, but the copy implies they've already exceeded it.

### Fix

**File: `src/components/planner/budget/BudgetWarning.tsx`**

Update the yellow-status messaging to reflect "approaching" rather than "over":

1. Change title from `"Trending Over Budget"` → `"Approaching Budget Limit"`
2. Fix the percentage to show proximity instead of negative overage: `"You've used 86% of your budget — $341 remaining."`
3. Keep the red-status messaging ("Over Budget", actual overage amount) unchanged since that's accurate when truly over.

**Specifically:**
- For yellow status, compute `remainingCents = summary.budgetTotalCents - summary.totalCommittedCents - summary.plannedTotalCents` and `usedPercent` (already available) to show: *"You've used {usedPercent}% of your budget — {remainingFormatted} remaining."*
- For red status, keep existing overage messaging as-is (it's correct when over 100%).

