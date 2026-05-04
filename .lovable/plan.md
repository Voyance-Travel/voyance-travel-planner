I found two likely causes still capable of changing totals after the trip page renders:

1. `EditorialItinerary` still runs `syncBudgetFromDays(rawDays)` automatically on initial page load. That rewrites `activity_costs` from whatever is currently in the rendered JSON, then dispatches a `booking-changed` event with an optimistic total. This can produce the exact `+$340 just now` badge even when the user did nothing.
2. `generate-trip-day` still runs `handleRepairTripCosts` at chain completion, despite the earlier intent to make repair one-shot/manual. That can silently rewrite costs after a generation finishes.

Plan:

1. Stop page-load budget rewrites
   - Remove or tightly gate the initial-load `syncBudgetFromDays(rawDays)` effect in `EditorialItinerary`.
   - Keep cost sync only for explicit user edits: swap, add/remove activity, manual save, regenerate button, booking/hotel/flight changes.
   - Prevent `booking-changed` from being dispatched during passive initial hydration.

2. Remove automatic post-generation cost repair
   - Delete the `handleRepairTripCosts` call at the end of `action-generate-trip-day.ts`.
   - Keep pricing repair available only through:
     - one-time legacy backfill when a trip has no cost rows and has never been repaired, or
     - the explicit “Repair pricing” user action.
   - This aligns the code with the existing memory/intent that post-regeneration repair was removed.

3. Make the live mutation badge honest
   - Update `useTripFinancialSnapshot` so it only records `lastDelta` for real post-load changes, not hydration/fallback replacement or optimistic initial sync.
   - Add a short suppression window for the first canonical load so the header doesn’t display “just now” for a total that was merely loaded from the database.
   - Continue warning/logging for true later changes.

4. Preserve canonical totals across sessions
   - Treat existing `activity_costs` as the canonical snapshot once present.
   - Do not recalculate and overwrite activity costs on page load just because JSON activity cost chips differ.
   - Avoid deleting/reinserting all cost rows except during explicit full regeneration.

5. Add regression coverage
   - Add/update tests around the pricing paths to verify:
     - loading an existing trip does not invoke cost repair,
     - loading an existing trip does not rewrite `activity_costs`,
     - post-generation does not run automatic repair,
     - explicit repair still logs cost changes and stamps `last_cost_repair_at`.

Expected result:
- Opening a trip will not mutate prices.
- The trip total will not swing between sessions without a user action.
- The `+$340 just now` badge will no longer appear on page load unless an actual explicit action changed costs after load.
- Regeneration may still produce a new total when the user explicitly regenerates, but it will not be followed by a second silent repair/rewrite pass.