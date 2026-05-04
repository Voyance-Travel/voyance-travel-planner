I found the likely root cause from the app’s own logged client errors: the Budget tab is throwing React error #310, which decodes to “Rendered more hooks than during the previous render.” The specific offender is `BudgetCoach`: it returns early when the trip is not over budget, but declares additional `useState` hooks later when the trip becomes over budget. That means when Budget loads and totals change, React sees a different hook count and crashes. The outer error boundary then replaces the whole trip content with the “Small detour” page, which matches what you saw.

Plan:

1. Fix the hook-order crash in Budget Coach
   - Move all `useState` hooks in `src/components/planner/budget/BudgetCoach.tsx` above any conditional return.
   - Specifically, `bumpDismissedAtTotal` and `isBumping` must be initialized before the `if (!isOverBudget) return ...` branch.
   - Keep all derived calculations after hooks, so the UI behaves the same without violating React’s hook rules.

2. Add a local Budget-tab fallback so one budget widget cannot strip the trip UI
   - Wrap the `BudgetTab` render inside `EditorialItinerary.tsx` with an error boundary fallback scoped to the budget content area.
   - The fallback will show a small inline “Budget didn’t load” panel with a retry/refresh action, instead of replacing the whole trip page and removing the tab bar.

3. Harden Budget loading failures
   - Update `useTripBudget` / `tripBudgetService` query behavior so failed budget reads degrade to safe defaults (`null`, `[]`) rather than bubbling a render-time crash.
   - Add explicit console/error logging for budget settings, summary, ledger, and allocation failures so future failures identify which query failed.

4. Reduce repeated failing loads
   - For budget queries, avoid aggressive retry loops that can make the tab flash overview content and then crash repeatedly.
   - Use controlled retry behavior and render a stable loading/error state for the Budget tab.

5. Verify the fix
   - Re-open the trip, click Budget multiple times, and confirm:
     - the tab stays selected,
     - the tab bar remains visible,
     - no “Small detour” full-page fallback appears,
     - the Budget Coach renders both on-target and over-budget states without hook errors.