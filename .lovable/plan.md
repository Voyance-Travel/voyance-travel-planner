

# Budget Display Is Showing Three Different Numbers

## The Problem

The Budget tab shows conflicting figures because it reads from **three independent data sources** that are out of sync:

| What | Source | Value | Why |
|------|--------|-------|-----|
| Header "Trip Total" | JS calculation from itinerary | ¥149,922 (~$1,003) | Correct — sums all activity costs live |
| "Expected Spend" card | `activity_costs` table via `v_trip_total` | $20 | Wrong — only 1 stale row synced |
| Category breakdown totals | `trip_budget_ledger` table | $256 | Partial — ledger sync worked partially |

The previous fix added a JS fallback for when the snapshot is stale, but the `jsTotalCostCents` prop being passed is `jsTotalCost * travelers * 100` where `jsTotalCost` is per-person USD. Meanwhile the snapshot reports in USD cents. The fallback may be working but the **category breakdown still reads from the ledger**, creating a mismatch.

Additionally, the "Expected Spend" label is ambiguous — it doesn't clarify whether it means "total planned cost of the trip" or "amount actually booked/confirmed."

## The Fix — 3 Changes

### 1. Make "Expected Spend" always use the JS-calculated total as primary
**File: `src/components/planner/budget/BudgetTab.tsx`**

Instead of the current fallback logic (use JS only when snapshot < 20% of JS), **always prefer the JS total when available** since it's the only source guaranteed to reflect the current itinerary. The snapshot becomes a secondary validation signal, not the primary.

- Replace the `snapshot` memo logic: if `jsTotalCostCents > 0`, always use it for `tripTotalCents`
- Keep `paidCents` from the DB snapshot (that data only exists in the DB)
- Recalculate `budgetRemainingCents` and `toBePaidCents` from the corrected total

### 2. Align category breakdown with the same total
**File: `src/components/planner/budget/BudgetTab.tsx`**

The category breakdown (`allocations`) comes from `useTripBudget` → `getCategoryAllocations` → `getBudgetSummary`, which reads from `trip_budget_ledger`. When the ledger is also incomplete, the category "used" numbers don't add up to the Expected Spend.

- Add a "Total from itinerary" row below the category bars that shows `jsTotalCostCents` as the authoritative total
- When category used totals are suspiciously lower than jsTotalCostCents (same <20% check), show an info banner: "Category totals are syncing — the Expected Spend above reflects your full itinerary"

### 3. Clarify labels and add scope context
**File: `src/components/planner/budget/BudgetTab.tsx`**

- Rename "Expected Spend" → "Trip Expenses" with a subtitle "Total estimated cost for all travelers"
- Add a small "per person" line showing `jsTotalCostCents / travelers`
- When budget currency differs from USD, show both (e.g., "$1,003 USD · ¥149,922")
- On "Budget Remaining", clarify: "Budget minus trip expenses"

### Files Changed
- **`src/components/planner/budget/BudgetTab.tsx`** — Use JS total as primary for Expected Spend, align category totals, clarify labels

