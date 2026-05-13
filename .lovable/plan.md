Plan to fix the Budget tab spinner:

1. Tighten the spinner source of truth
   - Update `getBudgetSummary` so `isGenerating` is not based only on `trips.itinerary_status`.
   - Treat a trip as still calculating only when generation is actively running and costs are not yet materially available.
   - If the itinerary already has meaningful activities/cost rows and no fresh generation heartbeat indicates active work, clear `isGenerating` even if the trip row is stale-stuck as `generating` or `queued`.

2. Use generation heartbeat instead of broad row updates
   - Replace the current stale gate that relies on `trips.updated_at` with generation-specific metadata such as `generation_heartbeat`, `generation_completed_at`, `generation_completed_days`, and `generation_total_days`.
   - This prevents unrelated trip updates from refreshing `updated_at` and keeping “CALCULATING…” alive forever.

3. Keep the Budget tab display stable
   - Leave the existing Trip Expenses and Budget Remaining totals driven by `useTripFinancialSnapshot`.
   - Only change the “CALCULATING…” badge/pulse behavior so stable totals like `$524` render as final once calculation is no longer genuinely active.

4. Add regression tests
   - Extend `src/services/__tests__/getBudgetSummaryStaleGen.test.ts` to cover:
     - stuck `generating` status with meaningful cost rows clears `isGenerating`;
     - stale generation heartbeat clears `isGenerating` even if `updated_at` is recent;
     - fresh heartbeat still shows `isGenerating=true` during active generation;
     - `ready`/frozen trips remain non-calculating.

Technical notes:
- Main files: `src/services/tripBudgetService.ts`, `src/services/__tests__/getBudgetSummaryStaleGen.test.ts`.
- No database migration is needed.
- I will keep this scoped to Budget tab calculation state, not itinerary generation or cost estimation logic.