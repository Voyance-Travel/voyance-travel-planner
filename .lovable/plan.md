

## Multi-City Budget Splitting

Five changes to split the trip budget proportionally across cities by nights, pass per-city budgets to AI generation, and display per-city breakdowns in the Budget tab.

### 1. Database migration: Add `allocated_budget_cents` to `trip_cities`
```sql
ALTER TABLE trip_cities ADD COLUMN IF NOT EXISTS allocated_budget_cents INTEGER DEFAULT 0;
```

### 2. `src/pages/Start.tsx` — Split budget after trip_cities insertion
After the multi-city `trip_cities` insert succeeds (line ~2521), add budget splitting logic:
- Calculate `totalNights` from destinations
- Allocate `budgetCents` proportionally by each city's nights
- Apply rounding correction to first city
- Update each `trip_cities` row with `allocated_budget_cents`
- Also handle single-city case: allocate full budget to the single row

### 3. `supabase/functions/generate-itinerary/index.ts` — Use per-city budget for AI
After the existing budget calculation (line ~4228), when `isMultiCity` and `tripCities` are available:
- Look up the current city's `allocated_budget_cents` from the queried `tripCities` array
- Subtract that city's `hotel_cost_cents` if hotel is included in budget
- Compute `dailyBudgetPerPerson` from the city's allocation instead of the trip-level value
- Override `context.dailyBudget` and `context.actualDailyBudgetPerPerson` for that city's days

### 4. `src/services/tripBudgetService.ts` — Add `getCityBudgetBreakdown()`
New exported function + `CityBudget` interface:
- Queries `trip_cities` for the trip, selecting budget/cost columns
- Returns array of `{ cityId, cityName, nights, allocatedBudgetCents, spentCents, remainingCents, breakdown }` or `null` for single-city

### 5. `src/components/planner/budget/BudgetTab.tsx` — Per-city budget display
- Import and call `getCityBudgetBreakdown` via `useQuery` keyed on `tripId`
- After the Budget Settings card (~line 503) and before Recent Expenses, render a "Budget by City" section when `cityBudgets` has >1 entry
- Each city shows: name, nights, allocated amount, progress bar of spent vs allocated, remaining amount
- Uses existing `formatCurrency` helper

### What stays unchanged
- Single-city trips — no per-city display, budget works as before
- Trip-level `budget_total_cents` — still the master budget
- Budget ledger, flight sync, credit system — all unchanged

