

## The Real Problem: Three Parallel Cost Systems

You're right — this shouldn't be complicated. The issue is that the codebase has **three separate systems** all trying to track the same thing:

| System | Table | View | Used by |
|--------|-------|------|---------|
| **Activity Costs** | `activity_costs` | `v_trip_total`, `v_payments_summary` | Itinerary (originally), Payments items |
| **Budget Ledger** | `trip_budget_ledger` | `trip_budget_summary` | Budget tab, `useTripFinancialSnapshot` |
| **Payments** | `trip_payments` | (none) | Payments tab paid amounts |

Each stores costs differently, syncs at different times, and computes totals with different logic. That's why the numbers never match.

---

## The Fix: One Table, One View, One Number

**Use `activity_costs` as the single source of truth.** It already has per-activity rows with `cost_per_person_usd`, `total_cost_usd`, `num_travelers`, `is_paid`, `paid_amount_usd`, `category`, and `day_number`. It also already has views (`v_trip_total`, `v_payments_summary`) that compute exactly what we need.

We add hotel and flight as rows in `activity_costs` (with a category like `'hotel'` / `'flight'`), so the view sums everything automatically.

### What changes

**1. Rewrite `useTripFinancialSnapshot` (~30 lines)**
- Query `v_trip_total` for `total_all_travelers_usd` → that's Trip Total
- Query `v_payments_summary` for paid/unpaid breakdown
- Query `trips.budget_total_cents` for budget
- Done. Three simple queries, one canonical total.

**2. Write hotel/flight into `activity_costs` when saved**
- When user saves a hotel → upsert one `activity_costs` row with `category='hotel'`, `activity_id='hotel-selection'`, the total price, and `is_paid=false`
- Same for flight → `category='flight'`, `activity_id='flight-selection'`
- This means `v_trip_total` automatically includes them

**3. Stop using `trip_budget_ledger` for totals**
- Remove `syncItineraryToBudget` calls (the ledger sync that's been causing drift)
- The budget tab reads from the same `v_trip_total` view
- `trip_budget_ledger` can remain for future committed-expense tracking but is no longer the source for "Expected Spend"

**4. Payments tab reads from `v_payments_summary`**
- Already exists as a view on `activity_costs`
- Shows `total_estimated_usd`, `total_paid_usd`, `total_remaining_usd`
- Individual items come from `activity_costs` rows directly

### Data flow (after fix)

```text
Itinerary generates activities
        ↓
   activity_costs table
   (one row per activity + hotel + flight)
        ↓
   v_trip_total view ──→ Trip Total (all tabs)
   v_payments_summary ──→ Paid / Remaining
   trips.budget_total_cents ──→ Budget
   Budget Remaining = Budget − Trip Total
```

### Files to modify

| File | Change |
|------|--------|
| `src/hooks/useTripFinancialSnapshot.ts` | Rewrite to query `v_trip_total` + `v_payments_summary` instead of `trip_budget_summary` |
| `src/services/budgetLedgerSync.ts` | Replace with `activity_costs` upserts for hotel/flight rows |
| `src/components/itinerary/EditorialItinerary.tsx` | Remove `syncItineraryToBudget` calls; trip total comes from snapshot |
| `src/components/itinerary/ItineraryAssistant.tsx` | Remove `syncItineraryToBudget` calls |
| `src/components/planner/budget/BudgetTab.tsx` | Read from snapshot instead of ledger summary |
| `src/components/itinerary/PaymentsTab.tsx` | Already uses snapshot (from last fix); verify item list uses `activity_costs` |

### What stays the same
- `activity_costs` table and its views — already correct
- `trip_payments` table — still tracks actual payment records
- The generate-itinerary edge function — already writes to `activity_costs`
- Budget settings (budget amount, currency, allocations) — still on `trips` table

