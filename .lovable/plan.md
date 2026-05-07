## Plan

1. **Make Payments buckets reconcile to the Trip Total**
   - Keep the Trip Total source as `useTripFinancialSnapshot` because it already matches Budget: `$276`.
   - Treat `miscReserveCents` as a real Payments bucket row so it is included in the visible category sum, not only in the header total.
   - Put that reserve under a clear non-logistics bucket label such as **Spending Money & Tips**, instead of silently folding it into **Travel Essentials**.

2. **Fix the stuck “Reconciling…” badge**
   - Update `PaymentsTab` reconciliation math so it compares the header total against every visible bucket, including the misc reserve.
   - Once the visible buckets total `$276`, the badge should resolve to **Matches itinerary**.
   - Keep the warning/debug log only for real drift after the reserve is included.

3. **Prevent Budget/Payments category label drift**
   - Keep Food, Activities, and Transit using the shared `toBudgetCategory` mapping.
   - Add a dedicated misc/reserve grouping in Payments so Budget’s reserve contribution does not disappear from Payments category totals.
   - Avoid changing the underlying pricing or trip data; this is a frontend reconciliation/display fix.

4. **Add regression coverage**
   - Add/extend tests around `usePayableItems` / Payments grouping so a trip with `$60` essentials + `$180` activities/food + `$36` reserve totals `$276` in Payments buckets.
   - Verify no double-count when actual misc rows already consume part/all of the reserve.

## Technical notes

- The `$36` gap is coming from `financialSnapshot.miscReserveCents`, which is added to the Budget/Trip Total but currently hidden inside `essentialItemsWithReserve` as `Spending money & tips reserve` while the visible buckets reported by the user only show `$60 + $180 = $240`.
- The persistent “Reconciling…” state is caused by `bucketSumCents !== estimatedTotal`; the fix is to make the bucket sum include the same reserve contribution the header includes, with a visible category card so users can see where the $36 went.