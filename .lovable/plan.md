

# Fix Budget Once and For All: Align with Payments Total

## The Root Problem

Budget is broken because there are **four independent cost totals** that never agree:

```text
┌─────────────────────────┐     ┌─────────────────────────┐
│  1. JS live calculation │     │  2. activity_costs DB   │
│  getDayTotalCost()      │     │  v_trip_total view      │
│  (per-person × travelers│     │  (synced fire-and-forget│
│   + estimation engine)  │     │   often stale/partial)  │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
  Used by: Itinerary header         Used by: useTripFinancialSnapshot
  & passed as jsTotalCostCents               ↓
            │                     ┌─────────────────────────┐
            │                     │  3. trip_budget_ledger  │
            │                     │  (planned entries from   │
            │                     │   syncItineraryToBudget) │
            │                     │  Used by: category bars  │
            │                     └─────────────────────────┘
            │
            ↓
  ┌─────────────────────────┐
  │  4. PaymentsTab total   │
  │  (JS-built payableItems │
  │   with smart estimation │
  │   + manual entries)     │
  └─────────────────────────┘
```

**Why they diverge:**
- **JS calc** uses `getActivityCostInfo()` with the estimation engine, returning per-person amounts that get multiplied
- **activity_costs sync** is fire-and-forget — it writes `costVal` (which could be per-person OR total depending on `act.cost` shape) as `costPerPersonUsd`, then the DB view multiplies by `num_travelers` again → **double-counting for flat-rate items**
- **trip_budget_ledger sync** does its OWN cost parsing with different per-person/total logic
- **PaymentsTab** does its OWN estimation with yet another set of heuristics
- After editing (swap, add, remove), `syncBudgetFromDays` fires asynchronously. The `useTripFinancialSnapshot` hook doesn't refetch until the `booking-changed` event fires, which only happens after the async sync completes — **so navigating away shows stale numbers**

**The specific $1000→$6816 bug:** When `syncActivitiesToCostTable` writes `costVal` from `act.cost.amount` (which for "per_person" basis activities is already per-person), it sets `costPerPersonUsd = costVal` AND `num_travelers = travelers`. The `v_trip_total` view then computes `cost_per_person_usd * num_travelers` — correct for per-person costs, but for flat-rate costs (dining group totals, entrance fees) it multiplies a group total by the traveler count again. With 2 travelers and mostly flat-rate costs, you get ~2× inflation, and with estimation filling in zeros, you get 6.8×.

## The Fix: Make Payments Total the Single Source of Truth for Budget

### Change 1: Unify Budget's "Trip Expenses" to use the same calculation as Payments
**File: `src/components/planner/budget/BudgetTab.tsx`**

Stop using `jsTotalCostCents` (the Itinerary header calc) AND stop using `useTripFinancialSnapshot` (the stale DB snapshot). Instead, compute the total the same way PaymentsTab does — by summing `payableItems.amountCents`. This means Budget and Payments will always show the same number.

- Import and use the same `payableItems` builder logic from PaymentsTab (extract it to a shared utility)
- Add manual payment entries to the total (per user preference)
- Remove the `jsTotalCostCents` prop entirely — no more passing a separately-calculated number

### Change 2: Extract payable items builder into a shared hook
**File: `src/hooks/usePayableItems.ts` (new)**

Extract the `payableItems` computation from PaymentsTab into a shared `usePayableItems` hook that both BudgetTab and PaymentsTab consume. This hook will:
- Take `days`, `flightSelection`, `hotelSelection`, `travelers`, `destination`, `destinationCountry`, `budgetTier`, `payments` as inputs
- Return the same `PayableItem[]` array and computed total
- Include manual payment entries in the total
- This ensures both tabs compute identical numbers

### Change 3: Update BudgetTab to consume shared hook
**File: `src/components/planner/budget/BudgetTab.tsx`**

- Replace `useTripFinancialSnapshot` + `jsTotalCostCents` with `usePayableItems`
- The "Trip Expenses" card shows `payableTotal` (sum of all payable items)
- "Paid" and "To be paid" come from matching against `trip_payments` records
- Category breakdown uses the payable items grouped by type instead of the stale `trip_budget_ledger`
- Remove `isCategorySyncing` logic — no more sync lag

### Change 4: Update BudgetCoach to use the same total
**File: `src/components/planner/budget/BudgetCoach.tsx`**

- `currentTotalCents` prop already comes from BudgetTab, so once BudgetTab is fixed, BudgetCoach automatically uses the right number
- No direct changes needed

### Change 5: Pass required props from EditorialItinerary
**File: `src/components/itinerary/EditorialItinerary.tsx`**

- Remove `jsTotalCostCents` prop from BudgetTab
- Pass `days`, `flightSelection`, `hotelSelection`, `destination`, `destinationCountry`, `budgetTier` to BudgetTab (most already passed via `itineraryDays`)
- Keep `syncBudgetFromDays` for the DB sync (background task, not for display), but it no longer drives UI numbers

### Change 6: Fix the per-person/flat-rate double-counting in activity_costs sync
**File: `src/components/itinerary/EditorialItinerary.tsx`** (in `syncBudgetFromDays`)

Even though we're decoupling Budget UI from the DB, fix the root write bug so `v_trip_total` is eventually correct:
- Use `getActivityCostInfo()` to determine the `basis` for each activity
- When basis is `flat`, set `costPerPersonUsd = costVal / travelers` so `cost_per_person_usd * num_travelers` in the view produces the correct group total
- When basis is `per_person`, set `costPerPersonUsd = costVal` as-is

## Files Changed
1. **`src/hooks/usePayableItems.ts`** (new) — Shared payable items builder extracted from PaymentsTab
2. **`src/components/planner/budget/BudgetTab.tsx`** — Use `usePayableItems` as source of truth instead of snapshot/jsTotalCostCents
3. **`src/components/itinerary/PaymentsTab.tsx`** — Refactor to consume `usePayableItems` hook
4. **`src/components/itinerary/EditorialItinerary.tsx`** — Remove `jsTotalCostCents` prop, fix per-person/flat double-counting in sync
5. **`src/hooks/useTripFinancialSnapshot.ts`** — Keep for paid tracking only, no longer used for trip total display

