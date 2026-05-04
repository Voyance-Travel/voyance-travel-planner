# Fix: Budget by Category breaks when fixed costs exceed the total

## Root cause (verified against the live row)

The trip in the screenshot has `budget_total_cents = 179_600` ($1,796) and `committedHotelCents ≈ $2,850`. The hotel alone is more than the entire budget.

`getCategoryAllocations` in `src/services/tripBudgetService.ts` (lines 655–731) then does:

```ts
const sharePct = Math.round((committedHotelCents / budgetTotal) * 100);
// → 2850/1796 ≈ 159 → "159% of total"

const discretionaryTotal = Math.max(budgetTotal - committedFixed, 0);
// → max(1796 - 2850, 0) = 0
// → every discretionary row's allocatedCents = round(0 * 35/100) = 0
```

So:
- **159% on Accommodation** is literally `committedHotel / budgetTotal`. Mathematically correct, semantically nonsense — "share of total" can't exceed 100%.
- **$0 allocated on Food / Activities / Transit / Misc** is because the discretionary pool went to zero. The percent badges in the JSX (`{alloc.percent}%`) still come from the saved allocation (35/35/10/5) — the UI just *displays* them next to "$… / $0", which reads as "0% allocated" to a user. (The DB allocations are persisting fine — confirmed via `read_query`; user is conflating "$0 allocated" with "0%".)
- **The total adds up** because `usedCents` is read directly from `summary.planned*Cents`, which is independent of the broken discretionary pool.

## Fix

### `src/services/tripBudgetService.ts` — `getCategoryAllocations`

1. **Clamp `shareOfBudgetPercent` at 100** and add an `exceedsBudget` flag (already exists). UI will say "$2,850 — over budget" instead of "159% of total".
2. **Discretionary fallback when fixed costs swallow the budget.** When `discretionaryTotal === 0` *and* there is real planned discretionary spend (`summary.plannedFood + plannedActivities + plannedTransit + plannedMisc > 0`), compute each category's `allocatedCents` from the **original budget total** using the saved percentages, instead of from the empty remainder. Tag the result with `discretionaryUnderwater = true` so the UI can show a single explanatory note (no per-row noise).
3. **Stop pretending the percent badge is share-of-spend.** Keep `percent` = the saved allocation (intent), but rename the UI sub-label so it reads "Target 35% of budget" rather than the ambiguous "35%" pill that the user mis-read as a usage bar.

### `src/components/planner/budget/BudgetTab.tsx` — Budget by Category

1. **Fixed row label.** Replace `({sharePct}% of total)` with:
   - `({sharePct}% of total)` when `!exceedsBudget`
   - `Over budget` (red) when `exceedsBudget`
2. **Discretionary underwater banner.** When `discretionaryUnderwater` is true on any row, render a single muted note above the discretionary section:
   > *Hotel costs have absorbed your full trip budget. Increase your total or toggle "Include Hotel in Budget" off to free up the discretionary pool.*
3. **Badge tooltip.** Add a `title="Target share of discretionary budget"` to the `{alloc.percent}%` badge so the meaning is unambiguous on hover.

### Out of scope

- No DB writes; allocations are already persisting correctly (verified).
- No change to `summary` math — `usedCents` and the underlying totals are correct.
- No change to spend-style defaults.

## Acceptance

For the affected trip:
- Accommodation row reads `$2,850 — Over budget` (red), not `159% of total`.
- Food/Activities/Transit/Misc rows show non-zero `allocatedCents` (computed from the original $1,796 × saved percentages) and a single explanatory line about the hotel absorbing the budget.
- The 35 / 35 / 10 / 5 badges still display correctly with a hover tooltip clarifying they're intent, not usage.
- Trip Expenses total ($4,506) is unchanged.
