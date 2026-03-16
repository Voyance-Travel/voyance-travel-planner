
I checked the budget flow end-to-end, and your skepticism is justified: this is not fully consolidated yet.

What I confirmed
- Budget total in `BudgetTab.tsx` uses `usePayableItems`.
- But budget summary/allocation bars still come from `trip_budget_ledger` via `useTripBudget` / `tripBudgetService.ts`.
- The itinerary header in `EditorialItinerary.tsx` still uses `useTripFinancialSnapshot` from `activity_costs`.
- So the app still has multiple active budget truths, not one.
- I also confirmed real data drift in the backend: recent trips show very large gaps between `v_trip_total` and `trip_budget_ledger` planned totals, so this is a real architecture problem, not user error.

Why Budget Coach is misbehaving
1. `BudgetCoach.tsx` only hashes activity IDs, not costs/titles/basis, so suggestion cache can stay stale after edits.
2. It marks suggestions as “Applied” immediately without waiting for the parent swap to actually succeed.
3. The parent swap handler in `EditorialItinerary.tsx` does a direct `upsertActivityCost(...)` after calling `syncBudgetFromDays(...)`.
4. That direct write uses:
   - `cost_per_person_usd = newCostWhole`
   - `num_travelers = travelers`
   - `category = 'activity'`
   regardless of whether the item is dining/transit and regardless of flat vs per-person basis.
5. That means a cheaper group-total swap can be re-saved as a per-person cost and multiplied again, which explains the “Budget Coach added money instead of removing it” behavior.

Why this keeps recurring
- We are “consolidating” at the component level, but not at the pricing math level.
- `usePayableItems` still does not fully preserve cost basis semantics (`per_person` vs `flat`) the same way itinerary rendering does.
- So even the new shared hook is not yet a complete canonical cost engine.

Implementation plan

1. Create one basis-aware cost engine
- Extract a shared pure utility for trip pricing that handles:
  - `amount`, `total`, `perPerson`
  - `basis` (`per_person`, `flat`, `per_room`)
  - estimation fallback
  - traveler multiplication rules
- This utility becomes the only way to compute:
  - per-activity group total
  - trip total
  - category totals
  - Budget Coach payload costs

2. Rewire all visible budget surfaces to that same engine
- Update:
  - `usePayableItems.ts`
  - `BudgetTab.tsx`
  - `PaymentsTab.tsx`
  - `EditorialItinerary.tsx`
- Result:
  - itinerary header
  - Budget tab total
  - Payments total
  - Budget Coach current total
  all use the exact same math.

3. Stop using ledger/views as live display truth
- Keep `activity_costs` and `trip_budget_ledger` as persistence/sync layers only.
- Do not use them for the visible “Trip Expenses” number.
- In `BudgetTab`, replace ledger-driven category “used” totals with category totals derived from the canonical pricing engine.
- Ledger can remain for manual rows / committed bookkeeping, but not as the displayed total source.

4. Fix Budget Coach apply flow so it only reports real savings
- Make `onApplySuggestion` return success/failure.
- In `BudgetCoach.tsx`, only mark a suggestion applied and remove it from the list after success.
- If the swap is blocked or persistence fails, keep the suggestion visible and show an error instead of fake success.

5. Remove the bad direct overwrite in the swap path
- In `EditorialItinerary.tsx`, remove the extra direct `upsertActivityCost(...)` write after swap.
- Let one basis-aware sync path own the write to `activity_costs`.
- If a direct write must remain, it must preserve:
  - original category
  - original cost basis
  - correct group/per-person normalization
- This is the key fix for “coach increased the trip total”.

6. Fix Budget Coach refresh behavior
- Update itinerary hashing in `BudgetCoach.tsx` to include cost/title/basis, not just activity IDs.
- Reset/refetch suggestions when:
  - itinerary costs change
  - a swap succeeds
  - total budget gap changes
- Remove the one-time `fetchedRef` behavior as the main control mechanism.

7. Add hard regression coverage
- Cost engine tests:
  - per-person item for 2 travelers
  - flat dining item for 2 travelers
  - mixed itinerary totals
- Budget Coach tests:
  - applied swap lowers total
  - failed swap does not show “Applied”
  - cache invalidates when cost changes
  - swap on flat-cost item never increases total
- UI-level checks:
  - itinerary header total = Budget total = Payments total for the same trip data

Files to update
- `src/hooks/usePayableItems.ts`
- `src/components/planner/budget/BudgetTab.tsx`
- `src/components/planner/budget/BudgetCoach.tsx`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/hooks/useTripFinancialSnapshot.ts` (either retire from live UI totals or narrow its role)
- `src/services/tripBudgetService.ts`
- likely a new shared pricing utility file for canonical cost math
- tests for pricing + Budget Coach behavior

Expected outcome
- One real pricing source of truth, not three UI truths plus two sync tables.
- Budget Coach only shows savings after a successful swap.
- Swaps cannot increase trip cost because flat/per-person semantics are preserved.
- Budget, Payments, and itinerary header stay aligned in real time.
