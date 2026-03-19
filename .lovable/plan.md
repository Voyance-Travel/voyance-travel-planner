

## Fix: Contradictory "Trending Over Budget" and "On target" messages

### Root cause

Two independent components compute budget status using different thresholds:

- **BudgetWarning** (banner): Shows "Trending Over Budget" when usage is **85–99%** (yellow zone)
- **BudgetCoach** (card below): Shows "On target" when `currentTotalCents <= budgetTargetCents` (i.e., usage **< 100%**)

So at 85–99% usage, both render simultaneously — one warning, one reassuring.

### Fix

**File: `src/components/planner/budget/BudgetTab.tsx`**

Pass the computed `snapshotStatus` to BudgetCoach (or conditionally hide it). The simplest correct fix: **don't render BudgetCoach when the warning banner is visible**. BudgetCoach's "On target" message is redundant/contradictory in the yellow zone, and its suggestions panel only activates when truly over budget anyway.

Change the BudgetCoach render condition (around line 431) to also require that the snapshot status is not `yellow`:

```tsx
{!isManualMode && hasBudget && itineraryDays?.length > 0 && summary && snapshotStatus !== 'yellow' && (
  <BudgetCoach ... />
)}
```

This requires hoisting `snapshotStatus` out of the IIFE on line 392 so it's accessible at line 431. Extract the budget status computation (lines 390–392) into a `useMemo` above both render blocks.

### Result
- At 85–99%: Only "Trending Over Budget" banner shows
- At 100%+: Both the red "Over Budget" banner and BudgetCoach suggestions show (no contradiction — both agree you're over)
- Under 85%: Neither warning nor coach renders

