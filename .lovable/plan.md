## Problem

The Payments header is still showing `Reconciling…` because the badge compares two totals that are built from different inclusion rules:

- `estimatedTotal` is based on the canonical financial snapshot, which respects trip budget inclusion toggles via `shouldCountRow(...)`.
- `payableTotalCents` is the visible Payments line-item total, currently built from all `activity_costs` rows without applying those same hotel/flight inclusion rules.

So the badge can remain stuck even when the UI is internally consistent enough for the user. In this session, the trip has manual paid hotel data plus canonical ledger data; the header comparison is too strict and not using a shared total contract.

## Fix

1. **Make Payments line items use the same inclusion rules as the Trip Total**
   - Update `usePayableItems` so it accepts the trip-level `budget_include_hotel` and `budget_include_flight` flags.
   - Filter `activityCosts` through the shared `shouldCountRow(...)` helper before generating visible payable rows.
   - This keeps the Payments list and Trip Total grounded in the same ledger definition.

2. **Pass the inclusion flags from `PaymentsTab`**
   - The `useTripFinancialSnapshot` hook already reads these flags internally, but `PaymentsTab` also needs them for `usePayableItems`.
   - Extend the activity-costs query (or a small adjacent trip settings query if cleaner) so `PaymentsTab` can pass `includeHotel/includeFlight` into the hook.

3. **Fix the sync badge comparison**
   - Compare the visible payable total to the same canonical total that actually drives the displayed Trip Total.
   - Keep a small rounding tolerance, but remove the current false-positive path where a valid manual override or excluded logistics row causes permanent `Reconciling…`.
   - If there is a manual hotel/flight override, treat it as an override delta consistently in both the header total and the badge comparison.

4. **Add lightweight diagnostics for future drift**
   - In development only, log the two compared totals and the delta when the badge would show `Reconciling…`.
   - This gives us the exact mismatch next time without exposing anything to production users.

## Files to update

- `src/hooks/usePayableItems.ts`
- `src/components/itinerary/PaymentsTab.tsx`

## Expected result

- The persistent `Reconciling…` indicator clears once the Payments item total and displayed Trip Total are using the same inclusion/override rules.
- The Payments rows remain itemized as before.
- Manual hotel/flight overrides no longer keep the sync badge in a permanent amber state.
- No database schema changes are needed.