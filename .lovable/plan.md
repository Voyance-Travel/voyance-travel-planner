## Problem

Two related bugs around manually-added hotel payments:

1. **Budget tab ignores manual hotel cost.** `useTripFinancialSnapshot` only sums `activity_costs`. When a manual hotel payment is recorded, `syncHotelToLedger` deliberately removes the canonical day-0 hotel row (to avoid double-billing), and the manual amount lives only in `trip_payments`. Result: BudgetTab shows $1,818 expenses instead of $4,218, even though "Include Hotel in Budget" is ON. PaymentsTab patches this locally with `manualExtraCents`, but BudgetTab doesn't.

2. **Stale "estimated nightly rate" disclaimer.** The banner in BudgetTab fires whenever `hasHotel && !hotelSelection.price`. It doesn't know the user already supplied a real cost via the manual Payments entry, so the disclaimer keeps showing as if no rate is set.

## Fix

### A. Snapshot folds in manual payments (single source of truth)

In `src/hooks/useTripFinancialSnapshot.ts`:

- After fetching `activity_costs`, also fetch `trip_payments` rows where `item_id LIKE 'manual-%'`.
- Apply the same override-aware delta PaymentsTab uses:
  - For `item_type = 'hotel'`: if a canonical day-0 hotel row exists, `delta = manualHotelCents - canonicalHotelCents`; otherwise add the full `manualHotelCents`. Only counted when `includeHotel` is true.
  - Same for `flight` (gated by `includeFlight`).
  - Other manual categories (dining/activity/transport/etc.) always add.
- Add the resulting delta to `tripTotalCents` and to `paidCents` (manual payments are by definition paid).
- Re-fetch on the existing `'booking-changed'` listener (already dispatched after manual entry CRUD).

This means BudgetTab automatically shows the right number with no changes there, and PaymentsTab can drop its local `manualExtraCents` workaround (or keep it as a no-op safety net — recommend deleting to enforce one source of truth).

### B. Suppress estimated-rate disclaimer when manual hotel exists

In `src/components/planner/budget/BudgetTab.tsx` (line ~488):

- Compute `hasManualHotelPayment` from `payments` (or accept it via prop from the parent that already knows).
- Treat that as satisfying `hotelHasPrice`, so `hotelMissingPrice` becomes false and the "based on typical Paris luxury-tier hotels" banner stops rendering.

## Files

- `src/hooks/useTripFinancialSnapshot.ts` — fetch + fold manual payments, override-aware.
- `src/components/itinerary/PaymentsTab.tsx` — remove `manualExtraCents` and use `snapshot.tripTotalCents` directly (avoid double-add now that snapshot includes it).
- `src/components/planner/budget/BudgetTab.tsx` — suppress the estimated-rate banner when a manual hotel payment is present.

## Result

- Budget tab "Trip expenses" jumps from $1,818 → $4,218, matching Payments.
- Over-budget warning fires correctly (~$2,422 over a $1,796 budget).
- Estimated-rate disclaimer disappears once the manual hotel is recorded.
- All three views (Budget, Payments, header) read the same canonical total.