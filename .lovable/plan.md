## Plan: stop the persistent “−$X just now” and “Reconciling…” loop

### What I found
- The Monaco trip has `activity_costs` rows whose `activity_id`s no longer match the current itinerary JSON activity IDs.
- The header total uses `useTripFinancialSnapshot`, which tries to rescue orphan/missing cost rows.
- The inline equation and Payments badge also use `useTripDayBreakdown`, which currently sums raw `activity_costs` rows directly and does not use the same canonical resolver/orphan filtering.
- That means the header total, day subtotal, and Payments total can disagree forever even when no user action happened, producing:
  - persistent `Reconciling…`
  - stale `−$120 just now` / similar delta indicators
  - repeated patterns across Bali, Barcelona, Monaco

### Implementation steps
1. **Unify day breakdown with the canonical resolver**
   - Update `useTripDayBreakdown` so it receives enough trip context (`itinerary_data`, travelers, manual payments, include toggles) and aggregates the same resolved rows that `useTripFinancialSnapshot` uses.
   - This prevents raw orphan rows from being counted in one place while rescued/dropped rows are counted differently elsewhere.

2. **Prevent load-time/system deltas from rendering as user-facing changes**
   - Harden `useTripFinancialSnapshot` so automatic reconciliation/refetch/backfill deltas do not set `lastDelta`.
   - Keep diagnostics in console logs, but do not show “−$X just now” unless the change follows a clear user action or attributed pricing repair.

3. **Make the reconcile badge bounded and non-sticky**
   - Keep the existing timeout behavior, but make sure a persistent data mismatch does not continually remount/re-arm the badge.
   - If the numbers still disagree after the one silent resolve attempt, hide the label and log the mismatch for debugging instead of showing “Reconciling…” indefinitely.

4. **Add regression coverage**
   - Add/adjust tests around the Monaco-style case: stale `activity_costs.activity_id`s + current itinerary JSON IDs.
   - Verify header total, equation row, and Payments trip total all use the same resolved total.

5. **Validate against recent affected trips**
   - Check Monaco (`0c8b2a37…`), plus the recent Bali and Barcelona trips, confirming:
     - no persistent “Reconciling…”
     - no load-time “−$X just now” indicator
     - Payments total matches the itinerary header within the expected tolerance

### Technical notes
- Primary files likely involved:
  - `src/hooks/useTripFinancialSnapshot.ts`
  - `src/hooks/useTripDayBreakdown.ts`
  - `src/hooks/useReconcilingState.ts`
  - `src/components/itinerary/PaymentsTab.tsx`
  - existing tests around financial snapshot / Payments totals
- No database schema change should be needed; this is a frontend canonicalization/resolver consistency fix.