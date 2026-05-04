I found the persistent duplicate source:

- The manually-added hotel payment is in `trip_payments`: `Four Seasons Hotel George V - 3 nights` for `$2,400`.
- The system placeholder is still in `activity_costs`: category `hotel`, day `0`, source `logistics-sync`, notes `Hotel: Four Seasons Hotel George V, Paris (estimated)`, amount `$2,850`.
- `usePayableItems` already tries to hide the canonical hotel when a manual hotel exists, but the data and totals still remain vulnerable because the stale day-0 hotel ledger row is still present and budget/snapshot paths read from `activity_costs`.

Plan:

1. Harden hotel ledger sync so placeholders do not override manual stays
   - Update `src/services/budgetLedgerSync.ts` so `syncHotelToLedger` first checks for an existing manual hotel payment for the same trip.
   - If a manual hotel exists, remove the day-0 `activity_costs` hotel placeholder instead of inserting/updating it.
   - Also prevent the reference-rate fallback from creating a committed-looking placeholder when the hotel has no explicit user-entered `totalPrice` or `pricePerNight`; selected hotel without a price should not become an automatic `$2,850` bill.

2. Make Payments/Travel Essentials dedupe robust, not just ID-based
   - Update `src/hooks/usePayableItems.ts` so manual hotel rows override any canonical hotel rows by semantic match, not only by `manual-*` item IDs.
   - Keep manually-entered hotel expenses visible and paid, but suppress `hotel-selection` / day-0 hotel rows when a manual hotel for the same trip exists.
   - Fix the duplicate `addManualGroups('activity')` call if still present, because manual activities are currently appended twice.

3. Align Payments header reconciliation
   - Update `src/components/itinerary/PaymentsTab.tsx` so the “Matches itinerary / Reconciling…” comparison uses the override-aware payable total rather than adding raw manual payments on top of already-rendered manual rows.
   - Ensure Travel Essentials subtotal and Trip Total follow the same rule: manual hotel replaces system hotel, never adds to it.

4. Clean the corrupted existing data for the reported trip
   - Remove or zero out the stale `activity_costs` row for trip `7ea828ac-9db5-42e7-b9a2-daeed10dd71f` where category is `hotel`, day `0`, source `logistics-sync`, and notes contain `Four Seasons Hotel George V`.
   - Keep the manual `trip_payments` row for `Four Seasons Hotel George V - 3 nights` intact.
   - This must be a data update, not a schema migration.

5. Verify with read-only checks after the fix
   - Confirm the trip has only one hotel payable item in Travel Essentials: the manual `$2,400` Four Seasons stay.
   - Confirm the stale `$2,850 Hotel Accommodation` no longer contributes to the trip total.
   - Confirm hotel accommodation rituals in the itinerary (check-in, freshen up, return to hotel) remain `$0` and visible as logistics, not expenses.