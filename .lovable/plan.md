## Problem

When the user clicks "Raise budget to $X," the entire Budget Coach section vanishes from the Budget tab, even though the underlying budget update worked.

### Root cause

`src/components/planner/budget/BudgetTab.tsx:726` gates `<BudgetCoach />` rendering on:

```ts
... && snapshotStatus !== 'yellow' && ...
```

`snapshotStatus` is computed at line 520:
- `red`   → ≥ 100% of budget used (over budget)
- `yellow` → 85% – < 100% used (close to budget)
- `green` → < 85% used (comfortably under)

So when a user raises their budget to a value just above current spend, the trip transitions from **red → yellow**, which the gate explicitly excludes. Result: the Coach disappears with no explanation.

There is no separate yellow / "near budget" UI in the Coach — when it does render on green, the existing on-target card (`BudgetCoach.tsx:626-640`) handles the under-budget state. Yellow simply has no surface today.

## Fix

### 1. Stop hiding the Coach in the yellow band (`BudgetTab.tsx`)
Remove the `snapshotStatus !== 'yellow'` clause from the render gate so the Coach renders on green, yellow, and red whenever there is suggestable content. The other guards (manual mode, empty itinerary, failed trip, hasBudget, hasSuggestableContent) stay intact.

```ts
// before
... && summary && snapshotStatus !== 'yellow' && (() => { ...

// after
... && summary && (() => { ...
```

### 2. Give the Coach a real "near budget" state (`BudgetCoach.tsx`)
The current `!isOverBudget` branch (lines 626-640) renders one generic emerald "On target" card. Split it into two visually similar variants driven by remaining headroom:

- **Comfortably under** (≥ 15% headroom): existing emerald "On target — you're within your $X budget" card. No change.
- **Close to budget** (< 15% headroom, still ≤ 0 gap): amber-tinted card with copy like:
  - Title: "You're close to your budget"
  - Body: "Only **$X (Y%)** of your **$BUDGET** budget is left. Nice work staying on plan — keep an eye out for new bookings."
  - Optional secondary action: "Edit budget…" (reuses `onEditBudget`).

Headroom percent is derived locally from `budgetTargetCents` and `currentTotalCents` already in scope; no new props needed.

### 3. No backend / data changes
The Coach's AI-fetch logic (`fetchSuggestions`) is already gated on `isOverBudget`, so removing the outer yellow gate does not trigger phantom AI calls or re-introduce the hotel-only "phantom recommendations" bug. `hasSuggestableContent` still gates the wrapper.

### 4. QA
1. Trip far over budget → full Coach (12 suggestions, transit warning, gap analysis) renders. Unchanged.
2. Click "Raise budget to $X" → trip transitions to yellow → Coach now stays mounted and shows the new "close to budget" card. No more vanishing.
3. Trip well under budget → emerald "On target" card. Unchanged.
4. Hotel-only / failed itinerary → wrapper still hidden by `hasSuggestableContent` / `tripStatus !== 'failed'`.
5. Manual mode → still suppressed by `!isManualMode` guard.

## Files touched
- `src/components/planner/budget/BudgetTab.tsx` — drop the `snapshotStatus !== 'yellow'` condition on line 726.
- `src/components/planner/budget/BudgetCoach.tsx` — split the existing on-target early return into "comfortably under" vs "close to budget" variants.

No edge functions, schema, or memory updates required.