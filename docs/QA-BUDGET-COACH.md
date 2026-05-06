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
