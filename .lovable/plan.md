## Root cause

The issue keeps coming back because the app is not using one canonical contract for Payments totals.

There are three competing interpretations of the same money:

1. **Header total** comes from `useTripFinancialSnapshot` via `resolveCanonicalCostRows`.
2. **Visible Payments bucket total** comes from `usePayableItems` plus local bucket grouping in `PaymentsTab`.
3. **Paid/pending rows** come from `trip_payments`, where some code still assumes only `flight | hotel | activity`, while newer UI writes `dining | transport | shopping | other` too.

The likely repeated failure path is not just “transit has no Payments category”; it is more specific:

- `resolveCanonicalCostRows` treats any `source='logistics-sync'` row as a logistics row and `usePayableItems` skips logistics rows in the per-row loop because it assumes logistics rows are only day-0 hotel/flight.
- If a costed transit/transfer row is written with `source='logistics-sync'`, it can be counted in the headline total but not emitted as a visible Payments bucket item.
- Transit rows are also displayed as grouped `Local transit — Day N` rows with `type: 'activity'`, while manual transport rows use `type: 'transport'`. This means splits/payments/orphan detection do not consistently classify the same transit cost the same way.
- `tripPaymentsAPI` still types payments as only `flight | hotel | activity`, even though the DB now allows more categories, so older assumptions keep leaking back into reconciliation code.

That is why prior fixes changed the message from **“Reconciling…”** to **“Totals differ by $283”** without fixing the underlying mismatch: the UI got better at naming the drift, but the sources still disagree.

## Plan

1. **Make canonical row classification explicit**
   - Update `resolveCanonicalCostRows` so `isLogisticsRow` means only actual non-itinerary logistics rows, not every `source='logistics-sync'` row.
   - Day-0 hotel/flight rows stay logistics.
   - Day-level transport/transit rows with real costs remain normal payable rows so they can render in Payments.

2. **Unify transit item identity and category**
   - Keep grouped transit rows in Payments, but classify them consistently as `transport`/`transit` instead of sometimes pretending they are generic `activity` rows.
   - Ensure `budgetCategory: 'transit'` is always present for transit groups and recovered transit payments.
   - Normalize payment lookup so existing rows saved as either `activity + transit-dN` or `transport + transit-dN` are read together instead of becoming invisible/orphaned.

3. **Fix payment type definitions and write paths**
   - Update the frontend `TripPayment` and booking/payment request types to include the DB-supported item types: `dining`, `transport`, `shopping`, and `other`.
   - Update split/assign/manual-payment code to write the canonical item type for each row, so transport stays transport and does not drift between categories.

4. **Align orphan detection with normalized categories**
   - Update `useTripFinancialSnapshot` orphan-payment logic so non-manual `transport` rows are not incorrectly handled as generic activity rows.
   - Preserve paid rows, but do not let stale transit rows count against the total if the underlying grouped transit item no longer exists.

5. **Add regression coverage**
   - Add/extend tests around `canonicalCostRows` and `usePayableItems` for:
     - costed day-level transport row with `source='logistics-sync'` appears in Payments and in the headline total exactly once;
     - grouped transit amount reconciles with header total;
     - old `activity/transit-dN` payment rows and new `transport/transit-dN` rows both attach to the same visible transit group;
     - manual transport expenses land in the transit bucket and do not trigger drift.

6. **Optional data cleanup, only if needed after code fix**
   - If existing trips have stuck payment rows with old transit item types, run a targeted data update to normalize only non-paid/non-archived transit group rows.
   - Do not touch paid records unless they are proven orphaned and already covered by the existing archival policy.