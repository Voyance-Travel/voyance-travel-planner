
Problem rephrased

This is not a math bug. It is still an architecture bug: the app is rendering “total trip” and “trip expenses” from different cost systems.

Do I know what the issue is?

Yes.

What I verified
- The itinerary header total is coming from `useTripFinancialSnapshot` → `activity_costs` / `v_trip_total`.
- The Payments tab and Budget Coach path are coming from `usePayableItems` → raw itinerary days + `hotelSelection` + `flightSelection` + `trip_payments`.
- For the live Tokyo trip, the backend total is `6287.88`.
- In `activity_costs`, hotel-related spend is fragmented:
  - `hotel`: `4050.00`
  - `accommodation`: `1538.47`
- The screenshot Payments view is showing a hotel line of `5400.00`, which is a different source again.

Exactly what is wrong
1. `EditorialItinerary.tsx` uses the DB-backed ledger total.
2. `PaymentsTab.tsx` and `BudgetTab.tsx` recompute totals from itinerary JSON via `usePayableItems`.
3. `BudgetCoach` inherits that recomputed total, so its advice is anchored to the wrong number.
4. Hotel spend is represented in multiple ways:
   - hotel selection
   - hotel ledger row (`category = 'hotel'`)
   - accommodation activities inside itinerary days
This guarantees drift.

Implementation plan

1. Create one canonical trip-cost source
- Build a shared hook/service for all cost surfaces.
- Source it from the normalized backend ledger/items, not raw itinerary day JSON math.
- Make these all use it:
  - itinerary “Trip Total”
  - Payments “Trip Expenses”
  - Budget tab totals
  - Budget Coach `currentTotalCents`

2. Remove duplicate hotel semantics
- Decide one payable representation for lodging.
- Recommended:
  - hotel/flight payable totals come from normalized logistics ledger rows
  - accommodation/check-in itinerary activities become display-only unless explicitly intended as payable activities
- Prevent hotel from being counted once from selection props and again from itinerary/ledger rows.

3. Retire `usePayableItems` as a total calculator
- Keep it only if needed for display shaping, but not for authoritative totals.
- If item rows are needed in Payments, derive them from the same canonical ledger-backed dataset as the total.

4. Consolidate sync paths
- Audit and simplify these flows so all mutations land in one normalization pipeline:
  - itinerary sync
  - `syncHotelToLedger`
  - booking add/edit
  - hotel injection / hotel save
- No local-prop or fallback path should be allowed to define a competing total.

5. Add regression coverage for this exact failure
- Trip with:
  - hotel selection
  - accommodation activities in days
  - no payments yet
- Assert:
  - itinerary total === payments total === budget total === budget coach total
  - hotel appears once in payable math
  - refresh does not change totals

Files to change
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/components/itinerary/PaymentsTab.tsx`
- `src/components/planner/budget/BudgetTab.tsx`
- `src/components/planner/budget/BudgetCoach.tsx`
- `src/hooks/usePayableItems.ts`
- `src/hooks/useTripFinancialSnapshot.ts`
- `src/services/budgetLedgerSync.ts`

Technical note
The current code still violates the “single source of truth” rule:
- header = DB ledger
- payments/budget/coach = recomputed UI state
- hotel = multiple representations

That is why fixes seem to “land” in one place and fail in another. The right fix is not another patch; it is to make every total read from the same canonical normalized source and to stop hotel costs from existing as competing payable models.
