

## Fix: Add feedback when "Include Flights" toggle has no effect

### Problem
The toggle logic is correct — it filters `activity_costs` rows with `category='flight'`. But no flight cost rows exist in the database (flights aren't auto-priced like hotels). When the user toggles "Include Flights" ON, nothing changes and there's no explanation, making it feel broken.

### Fix

**File: `src/components/planner/budget/BudgetTab.tsx` (lines 650-658)**

Add a helper note beneath the toggle when it's ON but no flight cost exists. After the switch's `onCheckedChange` fires, check whether any flight cost row exists for this trip. If not, show a small inline hint: "No flight cost added yet. Add one in the Flights & Hotels tab."

Specifically:
1. Query `activity_costs` for `category='flight'` rows for this trip (can reuse existing data from the budget summary, or add a simple derived check from the committed flight cents already computed).
2. Look at the existing `summary.committedFlightCents` — if it's `0` and the toggle is ON, render a `<p>` hint below the switch row.
3. Style: `text-xs text-amber-600` to draw gentle attention without being alarming.

### Scope
Single file: `src/components/planner/budget/BudgetTab.tsx`. ~5 lines added.

