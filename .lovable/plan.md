
Goal: make all money cards consistent and understandable, with “Spent” meaning Paid Only (your choice), and remove conflicting calculations.

What’s causing the mismatch now
1) Different tabs use different data pipelines:
- Itinerary header total uses itinerary/activity-derived totals.
- Payments tab mixes itinerary-derived totals + payment rows.
- Budget tab uses ledger planned+committed totals (not paid-only).
2) Budget “Spent” currently includes planned estimates, while Payments “Paid” is actual paid status.
3) Budget include toggles (especially flights) can exclude categories, making Budget numbers diverge from Payments/Trip Total.

Implementation plan

1) Create one shared financial snapshot layer
- Add a single `useTripFinancialSnapshot(tripId)` hook/service used by all three surfaces.
- It will output a normalized cents-only model:
  - `tripTotalCents` (planned + committed expense total)
  - `paidCents` (actual paid from payment records)
  - `toBePaidCents` (`tripTotalCents - paidCents`)
  - `budgetTotalCents`
  - `budgetRemainingCents` (`budgetTotalCents - paidCents`)  ← paid-only definition
  - `plannedUnpaidCents` (for secondary helper text)
- Keep all arithmetic in cents and clamp negatives.

2) Refactor UI cards to use the same snapshot
- Itinerary header (“Trip Total”) → `tripTotalCents` from snapshot.
- Payments header/cards:
  - “Trip Expenses” → `tripTotalCents`
  - “Paid” → `paidCents`
  - “Remaining” → `toBePaidCents`
- Budget top cards:
  - “Spent” becomes paid-only (`paidCents`)
  - “Remaining” becomes budget remaining vs paid (`budgetRemainingCents`)
  - Add subtle secondary line: “Planned but unpaid: …” to preserve planning context.

3) Align data sync so totals stay in lockstep
- Keep itinerary-to-ledger sync as source for expected trip expenses.
- Ensure manual expenses added in Payments also create/update matching committed ledger rows.
- Ensure unmark/delete in Payments removes or updates matching ledger rows.
- Keep flight/hotel sync in ledger as-is, but ensure it feeds the same snapshot path.

4) Label cleanup to remove ambiguity
- Replace vague labels where needed:
  - “Spent” → “Paid so far” (Budget + Payments where applicable)
  - Keep “Trip Total” for expected full cost
  - Keep “Remaining to pay” vs “Budget remaining” distinct.
- Add one tooltip/help line clarifying:
  - Trip Total = expected full expense
  - Paid = completed payments
  - Budget Remaining = budget minus paid

5) Validation + regression checks
- Test scenarios:
  1. No payments yet (Trip Total > 0, Paid = 0)
  2. Partial payments (Paid < Trip Total)
  3. Manual expense add/remove
  4. Flight included/excluded in budget settings
  5. Split-bill assignments
- Verify all cards show the same core totals across Itinerary, Payments, Budget.
- Verify cents/dollars formatting consistency and no $6.40-style scaling mistakes.

Files to update
- `src/components/itinerary/EditorialItinerary.tsx` (Trip Total source)
- `src/components/itinerary/PaymentsTab.tsx` (totals/cards source)
- `src/components/planner/budget/BudgetTab.tsx` (Spent/Remaining semantics + labels)
- New shared financial layer:
  - `src/services/tripFinancialSnapshotService.ts` (or hook equivalent)
- Potentially:
  - `src/services/tripBudgetService.ts` / `src/services/budgetLedgerSync.ts` (manual-expense parity sync)

Expected outcome
- One consistent financial truth across tabs.
- “Spent” means exactly paid-only everywhere.
- Differences become intentional and clear (Total vs Paid vs Remaining), not contradictory.
