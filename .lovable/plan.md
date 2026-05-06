# Fix: Budget Coach disappears after "Raise budget"

## Problem

When the user clicks **Raise budget to $X**, `applyRaiseBudget` persists the new total and `isOverBudget` flips to false. `BudgetCoach` then early-returns into a tiny green "On target" pill (`BudgetCoach.tsx` lines 655–667), so the swap suggestions, transit warning, gap analysis, and restructure panels all vanish with no acknowledgement that the raise was the cause and no way to undo.

## Goal

After a successful raise, render a clear celebratory card that:

1. Confirms the raise (old → new amount).
2. Shows headroom remaining against the new budget.
3. Offers an **Undo** button that reverts to the prior budget.
4. Auto-clears after the next budget edit so it doesn't linger across unrelated changes.

## Changes

### 1. `src/components/planner/budget/raiseBudgetApply.ts`
- Return the `previousBudgetCents` in `RaiseBudgetResult` so the caller can offer undo.
- No behavior change; pure additive field.

### 2. `src/components/planner/budget/BudgetTab.tsx`
- Track a local `lastRaise` state: `{ fromCents, toCents, at } | null`.
- On the **Raise budget** click handler, after `applyRaiseBudget` resolves with `ok: true`, set `lastRaise`.
- Pass `lastRaise` and an `onUndoRaise` handler down to `<BudgetCoach />` as new props. `onUndoRaise` calls `updateSettings({ budget_total_cents: lastRaise.fromCents })`, dispatches `booking-changed`, clears `lastRaise`, and toasts "Budget reverted to $X".
- Clear `lastRaise` whenever `settings.budget_total_cents` changes to a value other than `lastRaise.toCents` (any subsequent edit invalidates the undo affordance).

### 3. `src/components/planner/budget/BudgetCoach.tsx`
- Accept new optional props: `lastRaise?: { fromCents: number; toCents: number }` and `onUndoRaise?: () => void`.
- In the `!isOverBudget` branch (currently lines 626–667), when `lastRaise` is present **and** `budgetTargetCents === lastRaise.toCents`, render a new celebratory card instead of the existing on-target / close-to-budget cards. Card content:
  - Header: ✅ "Budget raised — you're on target"
  - Body: "Raised from `formatCurrency(fromCents)` to `formatCurrency(toCents)`. You now have `formatCurrency(remainingCents)` (`headroomPct%`) of headroom."
  - Buttons: **Undo raise** (calls `onUndoRaise`), **Edit budget…** (existing `onEditBudget`).
- The existing close-to-budget and plain on-target cards remain the fallback when `lastRaise` is absent.
- No changes to the over-budget rendering paths.

### 4. Tests
- Extend `src/components/planner/budget/__tests__/raiseBudgetApply.test.ts` to assert `previousBudgetCents` is returned on success.
- Add a small render test (or extend `budgetRaiseCta.integration.test.tsx`) confirming that after a raise the Coach shows the celebratory card with an Undo button, and clicking Undo invokes `updateSettings` with the original cents.

## Out of scope

- No change to the over-budget Coach UI, swap logic, edge functions, or the empty-itinerary gating from prior fixes.
- No persistence of `lastRaise` across reloads — it's an intentional in-session affordance.
