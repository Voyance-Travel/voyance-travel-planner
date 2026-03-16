
The reason this keeps “coming back” is that it is not one bug. It is an architectural split, so every time one surface is patched, another path reintroduces mismatch.

What’s keeping it from being fixed:
1. Budget UI is reading from two different ledgers at the same time.
   - `BudgetTab` card totals use `useTripFinancialSnapshot` → `activity_costs`
   - “All Costs”, summary math, and category allocations use `useTripBudget` / `tripBudgetService` → `trip_budget_ledger`
   - That guarantees drift. The UI is literally rendering totals from one source and line items from another.

2. There are still multiple write pipelines.
   - `EditorialItinerary` writes to `activity_costs` using the canonical pricing engine
   - `BudgetTab` and swap flows also re-sync `trip_budget_ledger`
   - `ItineraryAssistant` writes to `activity_costs` with a different calculation path that does not use `resolvePerPersonForDb`, so it can store the wrong basis directly
   - This violates the single-source-of-truth mandate and explains why the same discrepancy reappears after different edits/regenerations.

3. Different screens still have fallback math.
   - `PaymentsTab` prefers snapshot total but falls back to `usePayableItems`
   - `EditorialItinerary` prefers snapshot total but falls back to JS day-total estimation
   - Those fallbacks are useful during loading, but they also preserve alternate math systems.

4. Rounding/display math is still inconsistent.
   - Budget per-person display uses `Math.round(snapshot.tripTotalCents / travelers)`, which can create the “$218/person × 2 = $436 but total is $437” issue.

Design approach:
Make `activity_costs` the only canonical financial store for displayed trip costs everywhere, and demote/remove `trip_budget_ledger` from any total-driving UI logic.

Implementation plan:
1. Replace Budget tab’s item list and summary source
   - Refactor `tripBudgetService` so `getBudgetLedger`, `getBudgetSummary`, and `getCategoryAllocations` derive from `activity_costs` / views instead of `trip_budget_ledger`
   - Keep the same UI contracts if needed, but back them with the canonical ledger

2. Remove duplicate sync behavior
   - Stop calling `syncItineraryToBudget` from `BudgetTab` and swap flows
   - Route all itinerary/save/edit/regenerate/assistant updates through the existing `activity_costs` sync path only

3. Fix assistant write path
   - Update `ItineraryAssistant` to use the canonical pricing engine (`resolvePerPersonForDb`, `resolveCategory`) exactly like `EditorialItinerary`
   - This is a key reintroduction path today

4. Eliminate divergent totals in Payments and Itinerary
   - Use `useTripFinancialSnapshot` as the only displayed trip total after load
   - Keep local computed totals only as temporary loading placeholders, not as competing business logic

5. Fix Budget line-item rendering
   - “All Costs” must render rows derived from `activity_costs` so the visible list sums to the visible total
   - Category allocations must also derive from the same source, so category used values reconcile with total trip expenses

6. Fix rounding rules
   - Use floor/truncation for per-person display so displayed per-person never overpromises beyond the total
   - Ensure all displayed aggregate values are derived from cents, not mixed USD floats and cents conversions

7. Add a hard validation gate
   - Introduce one shared invariant for every loaded trip:
     - Budget total shown
     - Payments total shown
     - Itinerary header total shown
     - Sum of rendered cost rows
     must all match the same canonical cents total
   - If not, show a visible debug warning in development and refuse silent divergence

Files to change:
- `src/services/tripBudgetService.ts`
- `src/hooks/useTripBudget.ts`
- `src/components/planner/budget/BudgetTab.tsx`
- `src/components/itinerary/PaymentsTab.tsx`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/components/itinerary/ItineraryAssistant.tsx`

Why this has survived 10 fixes:
Because prior fixes corrected symptoms inside one path, but the product still has parallel read models and parallel write models. Until those are collapsed, the bug is expected to recur.

Expected outcome:
- One ledger
- One pricing engine
- One displayed total
- One itemized list that sums to that total
- No reintroduction when itineraries are edited by different features
