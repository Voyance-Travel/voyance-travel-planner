

## Fix: Hotel Budget Sync + NaN Display

Four changes across 4 files to fix the hotel-not-in-budget and NaN display issues.

### 1. `src/components/itinerary/FindMyHotelsDrawer.tsx` — Add budget sync + complete hotel data

- Import `syncHotelToLedger` from `@/services/budgetLedgerSync`
- In `handleSelectHotel` (lines 141-182), calculate `nights` from `startDate`/`endDate` props (already available as component props)
- Expand `hotelData` to include `totalPrice` (pricePerNight × nights), `checkIn` (startDate), `checkOut` (endDate)
- After both the multi-city (`cityId`) and single-city save paths, call `syncHotelToLedger(tripId, hotelData)` with `.catch()` for non-critical failure
- Fix multi-city `hotel_cost_cents` to use `hotelData.totalPrice` instead of just `pricePerNight`
- Add `startDate`/`endDate` to the `useCallback` dependency array

### 2. `src/services/supabase/trips.ts` — Add missing fields to HotelSelection

- Add `checkIn?: string` and `checkOut?: string` to the local `HotelSelection` interface (lines 117-127) to match `@/types/trip.ts`

### 3. `src/services/tripBudgetService.ts` — NaN guard

- Line 356: Change early return to `if (!settings || !settings.budget_total_cents || settings.budget_total_cents <= 0)`
- Lines 394-395: Use `const budgetTotal = settings.budget_total_cents || 0` then compute `remaining` and `usedPercent` from that, with a `budgetTotal > 0` guard on division

### 4. `src/components/planner/budget/BudgetSummaryPanel.tsx` — Display safety

- Line 82: `formatCurrency(summary.budgetTotalCents || 0)`
- Line 63 (usedPercent): Add fallback `const usedPercent = summary.budgetTotalCents > 0 ? Math.min(summary.usedPercent, 150) : 0`

