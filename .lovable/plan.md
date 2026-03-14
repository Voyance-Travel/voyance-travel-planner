

## Fix: Budget vs Payments misalignment, missing lodging category, and NaN display

### Issues found

**1. Budget tab excludes hotel costs that Payments tab includes**

The Budget tab's "Spent" amount comes from `getBudgetSummary()` which reads the `trip_budget_ledger` table. It only counts hotel costs when `settings.budget_include_hotel` is true AND there's a committed "hotel" entry in the ledger. However, the hotel ledger entry only gets written via `syncHotelToLedger()` which runs when the user saves/updates a hotel selection — but if the initial sync failed or was skipped, the hotel cost never makes it into the budget ledger.

Meanwhile, the Payments tab builds `estimatedTotal` from `payableItems` which directly reads `hotelSelection.totalPrice` from the trip data — no ledger needed. So Payments always includes hotel costs, while Budget may not.

**Fix**: In `BudgetTab.tsx`, on mount (alongside the itinerary sync), also trigger `syncHotelToLedger` and `syncFlightToLedger` to ensure committed costs are always present in the ledger. This already exists in `EditorialItinerary.tsx` line 1238 but NOT in `BudgetTab.tsx`. Add it there.

Additionally, the category mapping in `syncItineraryToBudget` (line 476) never maps activities with `hotel`/`lodging`/`accommodation` categories to the `hotel` budget category — they fall through to `activities`. Fix the mapping.

**2. No "lodging" allocation category in budget breakdown**

`getCategoryAllocations()` returns only `food`, `activities`, `transit`, and `misc` — no `hotel` or `flight`. The `BudgetAllocations` type also lacks hotel/flight percentages. However, hotel/flight are tracked as "committed" entries and shown separately in the summary cards. The issue is that the "Budget by Category" breakdown doesn't show a hotel row when `budget_include_hotel` is true.

**Fix**: Add `hotel` and `flight` to the category allocations returned by `getCategoryAllocations()` when the respective include flags are set. These won't have user-adjustable allocation percentages — they'll show actual committed amounts against the budget.

**3. NaN display when over budget**

The `BudgetWarning` component computes `overagePercent = Math.round(summary.usedPercent - 100)`. If `budgetTotalCents` is null (shouldn't happen since summary guards for it), `usedPercent` could be NaN. More likely, the NaN comes from the Remaining card's per-day calculation: `formatCurrency(Math.round((summary?.remainingCents || 0) / totalDays))` — if `totalDays` is 0 or undefined, this produces NaN. Also `remainingPercent` and the allocation `percent` computations can produce NaN when dividing by zero.

**Fix**: Add NaN guards:
- `totalDays` fallback to `Math.max(totalDays, 1)` in the per-day calculation
- Guard `formatCurrency` to return `$0` for NaN/Infinity inputs
- Guard `usedPercent` display with `isFinite()` check

### Files to edit

**`src/components/planner/budget/BudgetTab.tsx`**
- Add hotel/flight ledger sync on mount (import `syncHotelToLedger`, `syncFlightToLedger` from `budgetLedgerSync`)
- Guard `formatCurrency` against NaN: `if (!isFinite(cents)) return '$0'`
- Guard per-day remaining: `Math.max(totalDays, 1)`

**`src/services/tripBudgetService.ts`**
- In `syncItineraryToBudget` category mapping (~line 476): add hotel/lodging/accommodation → `'hotel'`
- In `getCategoryAllocations`: add hotel and flight rows showing committed amounts when include flags are set
- Guard `usedPercent` calculation: `budgetTotal > 0 ? ... : 0`

**`src/components/planner/budget/BudgetWarning.tsx`**
- Guard `overagePercent` and `overageCents` against NaN with `isFinite()` fallbacks

