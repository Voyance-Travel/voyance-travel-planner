## Problem

The Budget Coach surfaces a "Set aside spending money" nudge as the **first** card in its list, ahead of actionable swap suggestions, consuming prime real estate with a meta-task. Separately, the Spending Money & Tips category in the All Costs list can read as a "broken red zero" on every load.

A reserved-state visual is already in place for the category row in `BudgetTab.tsx` (lines 1021–1052: replaces the progress bar with a muted "$X reserved · 0 logged" chip + Add expense CTA when `misc && used === 0 && allocated > 0`). The remaining gap is **render order in the Coach** plus a small polish pass on the chip.

## Changes

### 1. Reorder the misc nudge in `BudgetCoach.tsx`

Move the "Set aside spending money" nudge block (currently lines 797–828, rendered as the **first** child of `CardContent`) to render **after** the `visibleSuggestions.map(...)` list (after line ~1090, before the on-target/empty-state footer). This keeps actionable swaps in the prime slot and demotes the meta-task to a secondary nudge below them.

Additional safeguards on the same block:
- Only render the nudge when **`!isLoading`** and **`!error`** (avoid stacking it above a spinner).
- Suppress the nudge entirely when `showHotelDominantPanel` is true — the structural restructuring panel already owns the user's attention; a $90 reserve nudge under it is noise.
- Lower visual weight: drop the `Sparkles` icon (reserve `Sparkles` for primary CTAs like the Bump-tier panel) and switch to a plain `Wallet` icon for consistency with the BudgetTab reserve chip.

### 2. Confirm the reserve chip in `BudgetTab.tsx`

The reserved-state branch already exists. Two small refinements while we're here:

- The right-hand value text on line 1012 (`{formatCurrency(used)} / {formatCurrency(allocated)}`) currently still reads `$0 / $90` in default foreground. For the misc reserve case, render that as `formatCurrency(allocated) + " reserved"` in `text-muted-foreground` instead of `$0 / $90`, so there is no "0" character at all in the row when nothing is logged.
- Ensure `isOver` styling on the value text never fires for misc when `used === 0` (it already doesn't, but assert with an explicit `!(alloc.category === 'misc' && used === 0)` guard for safety against future refactors).

### 3. No changes to allocation math, edge functions, or the budget-coach service.

## Files touched

- `src/components/planner/budget/BudgetCoach.tsx` — move the misc nudge below `visibleSuggestions`, gate on `!isLoading/!error/!showHotelDominantPanel`, swap icon.
- `src/components/planner/budget/BudgetTab.tsx` — replace the `$0 / $90` numeric line with a muted "$90 reserved" label when misc has zero usage.

## Out of scope

- Auto-populating the Spending Money category from the itinerary (the category is intentionally manual-only — see prior memory).
- Renaming or merging the category.
- Changing allocation percentages or default $90 reserve.