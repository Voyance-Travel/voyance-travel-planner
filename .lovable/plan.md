# Validate the "Raise budget to $X" CTA

## Problem

The inline "Raise budget to $X" button in `BudgetTab.tsx` (line 648) has never been verified end-to-end. Today the click handler is an inline closure:

```tsx
onClick={async () => {
  await updateSettings({ budget_total_cents: suggested });
  window.dispatchEvent(new CustomEvent('booking-changed'));
}}
```

This calls `useTripBudget.updateSettings` → `updateTripBudgetSettings(tripId, …)` → invalidates `tripBudgetSettings`, `tripBudgetSummary`, `tripBudgetAllocations`, then dispatches `booking-changed`. The path looks correct but is untested, and there is no toast confirming the change (unlike `setBudget`, which does toast).

## Plan

Mirror what we did for the Coach "Apply" path: extract the handler into a pure, testable helper, cover it with unit tests, and add a React integration test for the button.

### 1. Extract pure handler

New file `src/components/planner/budget/raiseBudgetApply.ts`:

```ts
export interface RaiseBudgetDeps {
  updateSettings: (s: { budget_total_cents: number }) => Promise<void>;
  dispatchBookingChanged: () => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
  formatCurrency: (cents: number) => string;
}

export async function applyRaiseBudget(
  currentBudgetCents: number,
  suggestedCents: number,
  deps: RaiseBudgetDeps,
): Promise<{ ok: boolean; reason?: string }> {
  if (!Number.isFinite(suggestedCents) || suggestedCents <= 0)
    return { ok: false, reason: 'invalid_suggestion' };
  if (suggestedCents <= currentBudgetCents)
    return { ok: false, reason: 'not_higher' };
  try {
    await deps.updateSettings({ budget_total_cents: suggestedCents });
    deps.dispatchBookingChanged();
    deps.toast.success(`Budget raised to ${deps.formatCurrency(suggestedCents)}`);
    return { ok: true };
  } catch {
    deps.toast.error('Failed to raise budget');
    return { ok: false, reason: 'mutation_failed' };
  }
}
```

### 2. Wire `BudgetTab` to use the helper

Replace the inline closure (lines 652–655) with `applyRaiseBudget(budgetCents, suggested, { updateSettings, dispatchBookingChanged, toast, formatCurrency })`. This also adds a success toast — currently missing — so users get feedback that the raise persisted.

### 3. Unit tests

`src/components/planner/budget/__tests__/raiseBudgetApply.test.ts` covering:

- happy path: suggested > current → `updateSettings` called with `{ budget_total_cents: suggested }`, dispatcher fired, success toast, returns `{ ok: true }`
- guard: suggested ≤ current → mutation NOT called, returns `{ ok: false, reason: 'not_higher' }`
- guard: invalid (0/NaN) suggestion → no-op, `invalid_suggestion`
- error path: `updateSettings` rejects → error toast, `mutation_failed`

### 4. Integration test

`src/components/planner/budget/__tests__/budgetRaiseCta.integration.test.tsx`:

- render `BudgetTab` with mocked `useTripBudget` returning a budget that triggers the over-budget banner and a `fit.suggestedBudgetCents` higher than current
- click "Raise budget to …" button
- assert `updateSettings` was called with the suggested cents
- assert `booking-changed` event fired (spy on `window.dispatchEvent`)
- assert success toast appeared

Mocks follow the existing pattern from `budgetCoachApply.integration.test.tsx`.

### 5. QA checklist

Append a "Raise budget CTA" section to `docs/QA-BUDGET-COACH.md` (or create `docs/QA-BUDGET.md`): trigger over-budget state → click Raise → verify (a) total updates in header, (b) percentages recalc, (c) banner disappears, (d) refresh persists.

## Files

- `src/components/planner/budget/raiseBudgetApply.ts` (new)
- `src/components/planner/budget/BudgetTab.tsx` (swap inline closure)
- `src/components/planner/budget/__tests__/raiseBudgetApply.test.ts` (new)
- `src/components/planner/budget/__tests__/budgetRaiseCta.integration.test.tsx` (new)
- `docs/QA-BUDGET-COACH.md` (append section)

## Out of scope

- Changing what `suggestedBudgetCents` resolves to (existing fit logic stays).
- Touching the Coach's two other "Raise budget to X" buttons in `BudgetCoach.tsx` — they already go through the Coach apply pipeline and have their own coverage. If you want, I can fold them onto the same helper in a follow-up.
