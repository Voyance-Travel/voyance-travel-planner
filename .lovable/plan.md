

# Fix: Budget Category Allocations Showing Tiny Numbers ($33, $11)

## Problem
When you set a $700 budget, the "Budget by Category" section shows allocations like $33 for food and $11 for transit instead of the expected ~$210 and ~$70.

## Root Cause
In `getCategoryAllocations()` (file: `src/services/tripBudgetService.ts`, line 604), discretionary category allocations are computed as percentages of `safeRemaining` — the amount **left over** after all committed and planned spending — instead of the **total budget**.

```typescript
// Current (broken): allocates from what's LEFT, not from total
const safeRemaining = Math.max(remaining, 0);  // e.g. $44 left from $700
allocatedCents: Math.round(safeRemaining * (allocations.food_percent / 100))  // 30% of $44 = $13
```

So if the itinerary already has $656 in planned costs, remaining is ~$44, and 30% of $44 = $13 — that's what shows up.

## Fix

**File:** `src/services/tripBudgetService.ts`

Change the allocation base from `remaining` to the **discretionary portion of the total budget** (total minus committed hotel/flight costs). This way category allocations reflect the intended budget split regardless of how much has been spent:

```typescript
// Fixed: allocate from total discretionary budget, not remaining
const discretionaryTotal = Math.max(0, budgetTotal - committedHotelAndFlight);
allocatedCents: Math.round(discretionaryTotal * (allocations.food_percent / 100))
```

With a $700 total and no hotel/flight committed, food at 30% = $210, transit at 10% = $70 — which is what users expect to see. The "used" column still shows actual spending, so over-budget categories are clearly visible.

### Specific change (lines 574-604):
- Compute `discretionaryBudget` = `budgetTotal` minus committed hotel (if included) and flight (if included)
- Use `discretionaryBudget` instead of `safeRemaining` for the allocation base

| File | Change |
|------|--------|
| `src/services/tripBudgetService.ts` | Use total discretionary budget (not remaining) as base for category allocation calculations |

