# Verify Budget Coach Apply End-to-End

## Findings

The Apply path is wired but never asserted by a test. The chain is:

```text
BudgetCoach.handleApply(s)
  → onApplySuggestion(s)                     [BudgetTab prop]
  → onApplyBudgetSwap(s)                     [EditorialItinerary inline handler, lines 6741-6861]
      ├ swap path:  setDays(...)             — replaces title / cost (strict-lower guard)
      └ drop path:  resolveDropTarget + setDays(...)  — removes activity
  → syncBudgetFromDays(updated)              [lines 1301-1422]
      ├ syncActivitiesToCostTable            — UPSERTs activity_costs rows
      ├ cleanupRemovedActivityCosts          — deletes orphan rows for dropped activities
      └ dispatchEvent('booking-changed')     — refetch trigger
  → queryClient.invalidateQueries(...)       — Budget allocations / summary / ledger

Listeners:
  • useTripFinancialSnapshot   → refetches trip total, paid, budget remaining
  • useTripDayBreakdown        → refetches per-day totals (header + day badges)
  • BudgetTab                  → fetchPaymentsForBudget()
  • PaymentsTab                → mounted with same activity_costs source
```

Logic is correct, but **not a single automated test exercises it**. The risk is real: the handler is a 120-line closure inside an 11k-line file and depends on `setDays`, `resolveDropTarget`, `enforceMealTimeCoherence`, and the canonical pricing engine inside `syncBudgetFromDays`.

## Plan

### 1. Extract pure swap logic to a testable module

Create `src/components/itinerary/budgetSwapApply.ts` exporting a single pure function:

```ts
applyBudgetSuggestion(
  days: EditorialDay[],
  suggestion: BudgetSuggestion,
): { ok: boolean; updatedDays: EditorialDay[]; reason?: 'not-found' | 'cost-not-lower' | 'stale' }
```

It contains the swap branch from lines 6785–6845 and the drop branch from lines 6747–6781 (minus the `setDays` / toast / queryClient calls). The caller in `EditorialItinerary.tsx` becomes:

```ts
const { ok, updatedDays, reason } = applyBudgetSuggestion(days, suggestion);
if (!ok) { /* existing toasts based on reason */ return false; }
setDays(updatedDays);
syncBudgetFromDays(updatedDays);
queryClient.invalidateQueries(...);
return true;
```

No behavior change — just lifts the deterministic part out so it is unit-testable and the inline handler stays thin.

### 2. Unit tests for the pure logic

`src/components/itinerary/__tests__/budgetSwapApply.test.ts` covers:

- **Swap success** — current cost > new cost: title, name, description replaced; cost.amount lowered; `cost.basis` preserved; bookingUrl/viatorProductCode/vendorPrice cleared.
- **Swap blocked** — new ≥ current returns `{ ok: false, reason: 'cost-not-lower' }` and leaves days untouched.
- **Drop success** — activity removed from the matching day; other days untouched.
- **Drop with cross-day stale `day_number`** — suggestion's `day_number` is wrong; `resolveDropTarget` still finds the activity on another day and removes it.
- **Drop not found** — returns `{ ok: false, reason: 'not-found' }`.
- **Meal-time coherence** — verifies `enforceMealTimeCoherence` is applied to swapped title for evening slots.

### 3. Integration test for the apply → sync → refetch chain

`src/components/planner/budget/__tests__/budgetCoachApply.integration.test.tsx` mounts `<BudgetCoach />` with:

- A handcrafted `suggestions` array seeded into the in-memory `suggestionsCache` so we bypass the edge-function fetch.
- A spy `onApplySuggestion` that resolves `true` after a 1-tick delay.

It then:

1. Asserts an Apply button is rendered for the seeded suggestion.
2. Fires `userEvent.click(applyButton)`.
3. Asserts `onApplySuggestion` was called with the seeded suggestion exactly once.
4. Asserts the suggestion is removed from the visible list (covers the post-apply prune at line 759).
5. Asserts a success toast is fired and the suggestion does not reappear after a re-render (cache-prune coverage).

A second case calls the spy with `Promise.resolve(false)` and asserts the suggestion **stays** in the list and an error toast is fired (covers the failure branch at line 744).

### 4. Manual reproducibility note

Add a paragraph to `docs/QA-BUDGET-COACH.md` (new file) listing the manual smoke steps for QA: open a trip with `currentTotalCents > budgetTargetCents`, scroll Coach, click Apply on a swap, watch trip-total badge drop, switch to Payments tab and confirm the row reflects the new title + cost. This documents the human path that the automated tests now cover deterministically.

## Files

- `src/components/itinerary/budgetSwapApply.ts` (new) — pure logic extracted from `EditorialItinerary.tsx`.
- `src/components/itinerary/EditorialItinerary.tsx` — replace inline body of `onApplyBudgetSwap` with a call to `applyBudgetSuggestion`. Keeps existing toasts and `syncBudgetFromDays` call.
- `src/components/itinerary/__tests__/budgetSwapApply.test.ts` (new) — unit tests.
- `src/components/planner/budget/__tests__/budgetCoachApply.integration.test.tsx` (new) — UI integration test through `BudgetCoach`.
- `docs/QA-BUDGET-COACH.md` (new) — manual repro checklist.

## Out of scope

- Edge function (`budget-coach-suggestions`) test coverage — separate concern.
- Mocking the entire `syncBudgetFromDays` Supabase write path; the integration test asserts the Coach side only and the parent wiring is asserted by the unit test on the extracted function.
