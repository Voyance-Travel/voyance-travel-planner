

## Fix: "Over Budget" label fires on sub-budget allocations, not total budget

### Problem

Hotel and flight selection cards show "**+X% over budget**" with a TrendingUp icon when the item price exceeds an **arbitrary sub-budget allocation** — even though the overall trip budget has plenty of room (e.g. $341 remaining of $2,500).

The sub-budgets are hardcoded:
- **Hotels**: `tripBudget * 0.6` (60% of total) — `PlannerHotelEnhanced.tsx:182`
- **Flights**: `tripBudget * 0.4` (40% of total) — `PlannerFlightEnhanced.tsx:247`

These percentages don't reflect the user's actual budget allocations and together already exceed 100%. A hotel that costs more than 60% of the budget will show "over budget" regardless of how the user has actually allocated their funds.

### Fix

**Replace the hardcoded sub-budget splits with the user's actual category allocations** from the budget settings. If no allocations are set, fall back to the real allocation percentages from `tripBudgetService`. If the overall budget still has headroom, suppress the warning entirely.

**Files to change:**

1. **`src/pages/planner/PlannerHotelEnhanced.tsx`** (line ~182)
   - Replace `tripBudget * 0.6` with the actual hotel allocation from budget settings
   - If no explicit hotel allocation exists, use a reasonable fallback but **also check if the overall budget is still under 100% used** before showing warnings
   - Add a condition: only show per-item "over budget" when the overall budget is also in warning/red status

2. **`src/pages/planner/PlannerFlightEnhanced.tsx`** (line ~247)
   - Same treatment for flights: replace `tripBudget * 0.4` with actual flight allocation
   - Gate the warning on overall budget status

3. **`src/components/planner/hotel/EnhancedHotelCard.tsx`** (lines 337-341)
   - Change the label from "+X% over budget" → "+X% over hotel allocation" to clarify scope
   - Or suppress entirely when `budgetPerNight` is not provided

4. **`src/components/planner/flight/EnhancedFlightCard.tsx`** (lines 247-251)
   - Same label change: "+X% over" → "+X% over flight allocation"
   - Or suppress when no flight budget is set

### Approach

The simplest, most impactful change: **suppress the "over budget" badge entirely when the overall budget is within limits** (green or on_track status). Only show per-item sub-budget warnings when the total budget is also in yellow/red territory. This prevents the misleading message while preserving useful warnings when the trip is genuinely over budget.

