

## Fix: Budget Tab Issues (4 Problems)

---

### Issue 1: Category Percentages Exceed 100%

**Root cause**: `getCategoryAllocations()` in `tripBudgetService.ts` (line 517-537) adds hotel and flight categories with percentages computed as `(committedHotelCents / budgetTotal) * 100` (e.g., 52%). Then it appends food (30%), activities (30%), transit (10%), misc (5%) — these are the slider percentages of the *discretionary* budget, not the total. The percent badge shows `alloc.percent` on line 597, mixing two different percentage bases.

**Fix**: Recompute all percent badges relative to total budget. For discretionary categories, scale: `displayPercent = sliderPercent × (discretionaryTotal / budgetTotal)`. This ensures hotel 52% + food ~14% + activities ~14% + transit ~5% + misc ~2% + buffer ~12% ≈ 100%.

**File**: `src/services/tripBudgetService.ts` — `getCategoryAllocations()` (lines 542-571). Change `percent: allocations.food_percent` → `percent: Math.round(allocations.food_percent * discretionaryTotal / budgetTotal)` for each discretionary category.

---

### Issue 2: Budget Coach Shows Total Prices, Not /pp

**Root cause**: `BudgetCoach.tsx` lines 414, 421, 431 multiply costs by `travelers`:
```
formatCurrency(s.current_cost * travelers)
formatCurrency(s.new_cost * travelers)  
Save {formatCurrency(s.savings * travelers)}{travelers > 1 ? ' total' : ''}
```

This shows group totals while the itinerary cards show `/pp`. The savings badge already adds "total" suffix for multi-traveler, but the cost labels don't clarify.

**Fix**: Show per-person costs with `/pp` suffix when travelers > 1, matching the itinerary card convention:
- Current item: `formatCurrency(s.current_cost)` + `/pp` suffix
- Suggested swap: `formatCurrency(s.new_cost)` + `/pp` suffix  
- Savings badge: keep group total but label clearly: `Save {formatCurrency(s.savings * travelers)} total ({formatCurrency(s.savings)}/pp)`

**File**: `src/components/planner/budget/BudgetCoach.tsx` — lines 413-431.

---

### Issue 3: Impossible Budget Not Flagged

**Root cause**: No validation warns users when their budget is fundamentally unreachable. The Budget Coach's max savings of $833 leaves $3,942 over — the system just says "Still $3,942 over" without actionable guidance.

**Fix**: Two changes:
1. **Budget Setup Dialog** (`BudgetSetupDialog.tsx`): When trip total is known and the entered budget is <50% of it, show an amber warning: "Your trip's estimated cost is $X. This budget may be difficult to achieve."
2. **Budget Coach** (`BudgetCoach.tsx`, line 499-502): When `totalPotentialSavings < gapCents`, enhance the "Still X over" message with actionable text: "Consider removing activities, choosing cheaper alternatives, or adjusting your budget to {formatCurrency(currentTotalCents - totalPotentialSavings)}."

**Files**: `BudgetSetupDialog.tsx`, `BudgetCoach.tsx`

---

### Issue 4: Costs Table Shows $0 for Most Items

**Root cause**: The `CostsList` renders `entry.amount_cents` from `getBudgetLedger()`, which computes `costPerPerson * numTravelers * 100` (line 323). If `cost_per_person_usd` is 0 in `activity_costs`, the amount shows $0. This means the sync from itinerary to `activity_costs` (`syncBudgetFromDays`) is not writing costs for most activities.

**Fix**: Investigate and fix the budget sync function that writes activity costs to `activity_costs`. The sync likely runs in `EditorialItinerary` and may be:
- Not matching activities to cost_reference entries
- Skipping activities without explicit cost objects
- Writing 0 for activities where cost data lives in a nested field

This requires reading `syncBudgetFromDays` to identify the exact failure. The fix will ensure every itinerary activity with a non-zero cost gets a corresponding `activity_costs` row with the correct `cost_per_person_usd`.

**Files**: Likely `src/services/` or `src/components/itinerary/` — the sync function that writes to `activity_costs`.

---

### Summary

| # | Issue | File(s) | Change |
|---|-------|---------|--------|
| 1 | Percentages > 100% | `tripBudgetService.ts` | Scale discretionary percents relative to total budget |
| 2 | Coach shows totals not /pp | `BudgetCoach.tsx` | Show /pp costs matching card convention |
| 3 | Impossible budget not flagged | `BudgetSetupDialog.tsx`, `BudgetCoach.tsx` | Add warnings and actionable guidance |
| 4 | $0 in costs table | Sync function (TBD) | Fix activity_costs sync to write actual costs |

