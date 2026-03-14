## Fix: Budget "All Costs" List Is Truncated to 10 Items

### Problem

Line 585 of `BudgetTab.tsx`: `ledger.slice(0, 10)` hard-caps the displayed cost items at 10. If the itinerary has 32 activities, only the first 10 appear.

### Fix

Add a "Show by Day, and add a show less and show all"  toggle so users can see every cost line item.

**File: `src/components/planner/budget/BudgetTab.tsx**`

1. Add a `showAllCosts` boolean state
2. Replace `ledger.slice(0, 10)` with a conditional: show all when toggled, otherwise show first 10
3. Add a "Show all X items" / "Show less" button below the list when `ledger.length > 10`
4. Update the card title to show the count: "All Costs (32)"

Single file change, ~15 lines added.