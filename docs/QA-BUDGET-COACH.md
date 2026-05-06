# Budget Coach Apply — Manual QA Checklist

The Apply button on Budget Coach swap suggestions is covered by automated tests:

- `src/components/itinerary/__tests__/budgetSwapApply.test.ts` — pure swap/drop logic
- `src/components/planner/budget/__tests__/budgetCoachApply.integration.test.tsx` — UI → handler → row pruning

For human verification of the full chain (DB write, Payments tab, header total):

1. Open a trip whose total exceeds its budget so Budget Coach surfaces suggestions.
2. Note the **Trip Total** in the header and the day badge for the suggested swap's day.
3. Click **Apply** on a swap suggestion.
4. Verify in order:
   - The suggestion row disappears from Coach.
   - A success toast appears.
   - The header **Trip Total** drops by the savings amount within ~1s.
   - The day badge for that day drops by the same amount.
   - On the **Itinerary** tab, the swapped activity shows the new title, description, and price; booking-CTA / vendor metadata cleared.
   - On the **Payments** tab, the corresponding row reflects the new title and amount; no duplicate row left behind.
   - Reloading the page preserves all changes (activity_costs persisted).
5. Repeat for a **Drop** suggestion — verify the activity is removed from both Itinerary and Payments, and the over-budget figure improves.

Rollback path: any change can be undone with the trip's regenerate / revert flow; activity_costs cleanup runs during regen.

## Raise budget CTA (BudgetTab inline)

Trigger: open a trip whose `activity_costs` total exceeds `budget_total_cents` so the red over-budget banner renders in the Budget tab.

1. Click **Raise budget to $X** in the banner.
2. Verify a "Budget raised to $X" success toast appears.
3. Verify the budget figure in the header / summary updates to $X.
4. Verify the over-budget banner disappears (or overage shrinks if still under target).
5. Verify percentages on each allocation row recalculate.
6. Hard-refresh the page — new budget total persists.
7. Switch to the Payments tab — totals reflect the raised budget.

Edge cases:
- Click the CTA when current === suggested: nothing should happen (button is hidden, but the helper guards anyway).
- Network failure during update: error toast "Failed to raise budget"; budget figure does NOT change.
