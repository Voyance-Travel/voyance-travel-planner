I found two connected failure modes:

1. **Fresh generation/resume can wipe or rebuild itinerary state**, which changes `trips.itinerary_data.days` and then causes totals to mutate session-to-session.
2. **Budget/Payments still depend on `activity_costs` as a separate ledger**, while the Itinerary tab renders `trips.itinerary_data.days`. Existing read-time orphan filters help, but stale or mismatched cost rows can still make Budget Coach and Payments behave as if a different itinerary version is current.

Plan:

1. **Add a stable itinerary fingerprint**
   - Compute a deterministic fingerprint from the saved live itinerary: day number, activity id, title/name, category, cost, and traveler count.
   - Store/pass this fingerprint through budget-facing code so Budget Coach suggestions are tied to the exact itinerary snapshot they were generated from.
   - If the live fingerprint changes, Budget Coach will clear suggestions and refetch from the current live itinerary only.

2. **Make Budget Coach read only the live itinerary payload**
   - Keep using the current client payload path (`BudgetTab -> BudgetCoach -> budget-coach function`) but strengthen it:
     - Include `itinerary_fingerprint` in the function request.
     - Return the same fingerprint with suggestions.
     - Drop rendered suggestions when the returned fingerprint no longer equals the current live fingerprint.
   - This prevents any cached or delayed response from showing suggestions for Ob-La-Di / La Méditerranée if the live Itinerary tab has already changed to Maison Sauvage / Le Comptoir du Relais / Septime.

3. **Add server-side Budget Coach guardrails**
   - In `supabase/functions/budget-coach/index.ts`, validate that every returned suggestion targets an activity id in the incoming payload and that `current_item` matches the incoming title.
   - Return `itinerary_fingerprint` in the response for client-side race protection.
   - Make the prompt explicitly state that the model may only reference activities listed in the provided payload, not prior context or payments/ledger rows.

4. **Reconcile `activity_costs` to the live itinerary after saves/regeneration**
   - Update the sync path so cleanup always runs even when there are zero paid activities in the live itinerary. Today `cleanupRemovedActivityCosts` only runs inside the “there are rows to sync” branch, which can leave stale rows if a regeneration removes all positive-cost activities or changes ids in an edge case.
   - Use the **full live activity id set** for cleanup, not only the positive-cost rows, so zero-cost live activities are preserved as valid while stale positive-cost rows from old itineraries are deleted.
   - Dispatch the existing `booking-changed` event after cleanup so Budget, Payments, and snapshot totals refetch together.

5. **Stop unapproved fresh regeneration from replacing a saved itinerary**
   - Harden `handleShowGenerator` / regeneration entry points so “Generate Itinerary” is only a fresh rebuild when the trip truly has no saved itinerary, or when the user explicitly chooses regenerate.
   - For resume/self-heal flows, require incomplete state before invoking `generate-trip`; do not treat a complete `itinerary_data.days` snapshot as something to regenerate just because status metadata is stale.
   - Keep the existing no-shrink guard, but add clearer early exits so a stable saved itinerary is not cleared and rebuilt on a later session.

6. **Unify Budget/Payments totals around the live itinerary version**
   - Ensure `useTripFinancialSnapshot`, `getBudgetLedger`, and `usePayableItems` all filter against the same live activity id set and ignore orphaned activity-bound cost rows.
   - Remove any remaining orphan-rescue naming behavior that can make old ledger rows appear under current-day labels.
   - Add a small developer diagnostic log when Payments/Budget counts differ from the live itinerary’s positive-cost activity count, so this regression is easier to catch.

7. **Optional targeted cleanup for the affected Paris trip**
   - After code changes, run a safe reconciliation for the affected trip record only: remove `activity_costs` rows whose `activity_id` is not present in its current `itinerary_data.days`, excluding logistics rows.
   - This is not a broad migration; it is a one-time cleanup for stale rows already created by the regression.

Files expected to change:
- `src/components/planner/budget/BudgetCoach.tsx`
- `src/components/planner/budget/BudgetTab.tsx`
- `src/components/itinerary/EditorialItinerary.tsx`
- `src/hooks/useTripFinancialSnapshot.ts`
- `src/hooks/usePayableItems.ts`
- `src/services/tripBudgetService.ts`
- `supabase/functions/budget-coach/index.ts`
- Potential small guard in `src/pages/TripDetail.tsx`

Validation after implementation:
- Budget Coach suggestions must only reference activity ids/titles visible in the current Itinerary tab.
- Payments list must not show restaurants absent from the live itinerary.
- Trip Expenses total must remain stable across refresh/session reload unless the user explicitly edits, saves, books, pays, or regenerates.
- Regeneration should not start from a saved completed itinerary unless explicitly requested.