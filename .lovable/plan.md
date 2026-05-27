## Plan: eliminate trip-total drift at the source

The recurring bug is not just one bad formula. The app currently has multiple independently-mounted financial readers:

- Itinerary header reads `useTripFinancialSnapshot` + `useTripDayBreakdown` and may display the balanced/clamped header-strip total.
- Payments tab reads its own `useTripFinancialSnapshot` instance plus `useDisplayedTripTotal`.
- Budget tab reads another separate `useTripFinancialSnapshot` instance and renders raw `snapshot.tripTotalCents`.

That means tabs can show different numbers during stale fetch windows or when the header uses the balanced displayed total while Budget uses the raw snapshot total.

### What I’ll change

1. **Create one canonical display model**
   - Add a shared hook/model that returns the user-visible trip total, raw snapshot total, chip sum, budget remaining, paid/to-be-paid, buckets, and reconciliation flags from one place.
   - This model will be the only source for any UI label named “Trip Total” / “Trip Expenses.”

2. **Make Budget tab stop using raw snapshot totals for visible totals**
   - Replace Budget tab’s visible `snapshot.tripTotalCents` usages for Trip Expenses, percentages, remaining, Budget Coach current total, setup dialog current total, and footer total with the canonical displayed total.
   - Keep raw snapshot only for diagnostics/internal reconciliation where needed.

3. **Make Payments tab and header consume the same display contract**
   - Ensure Payments tab’s headline and the itinerary header both render the exact same `displayedTotalCents` contract.
   - Remove dead/local manual hotel/flight computations in Payments that are no longer authoritative and can confuse future fixes.

4. **Centralize refresh behavior**
   - Wire `booking-changed` and `TRIP_PERSISTED_EVENT` through the same financial model so all tabs converge together instead of each tab running a separate timing race.
   - Keep the current silent-refetch behavior so users do not see phantom “price changed” messages.

5. **Add regression coverage**
   - Add tests around the shared display model/helper proving:
     - Budget visible total equals header displayed total.
     - Payments visible total equals header displayed total.
     - When `snapshotTotal < day chips + hotel/flight`, all three views render the clamped displayed total, not raw snapshot.
     - Budget remaining/percent calculations use the same displayed total.

### Success criteria

For the reported case, the three user-facing values must be identical:

```text
Itinerary summary header Trip Total = Payments tab Trip Total = Budget tab Trip Expenses/Trip total
```

No tab should ever render a different “Trip Total” by falling back to raw activity rows, local payable totals, or an independently lagging snapshot.