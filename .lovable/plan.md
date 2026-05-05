## Goal
Fix the structural transit-budget failure where Splurge-Forward trips allocate only 10% to Local Transit, making luxury Paris itineraries permanently red even after all reasonable taxi-to-metro swaps.

## Plan

1. Update Splurge-Forward default allocation
   - Change the Splurge-Forward preset from `35% food / 35% activities / 10% transit / 5% misc / 15% buffer` to a more realistic luxury split with transit at about 20%.
   - Preserve a 100% total by reducing buffer first and slightly reducing activity share if needed.
   - Keep Value-Focused and Balanced unchanged unless inspection shows they are affected by the same structural issue.

2. Make the preset UI explain the change
   - Update the Splurge-Forward preset tooltip/copy in the budget setup dialog so users understand it includes premium ground transport expectations, not just dining and experiences.
   - Keep the transit slider max as-is, since it already supports 20%+.

3. Make itinerary generation respect transit allocation
   - In the prompt allocation block, add explicit transit guidance based on the per-person/day Local Transit target:
     - If transit allocation is low, prefer walking/metro except required airport or accessibility legs.
     - If Splurge-Forward/luxury with higher transit allocation, allow selective taxis/private transfers but avoid taxi for every hop.
     - Treat airport transfers separately from ordinary in-city rides so the model does not spend the whole transit budget before the day begins.
   - This keeps generation from creating unavoidable transit overruns instead of relying only on Budget Coach swaps afterward.

4. Fix the transit cap repair math
   - The current repair pass derives a daily transit cap from the discretionary budget after hotel/flight. For luxury hotel trips, this can make the cap unrealistically tiny and then still leave the UI showing a category target based on the same low preset.
   - Align the cap with the same displayed allocation basis used by Budget by Category, while keeping airport/station transfers exempt from demotion.
   - Maintain the existing safeguards: do not modify locked, user-priced, booked, or airport/station transfer rows.

5. Make Budget Coach honest when swaps cannot solve transit
   - Add a transit-specific structural warning when Local Transit is over allocation but the available transit-swap savings cannot plausibly close the category gap.
   - Instead of only suggesting more taxi-to-metro swaps, surface a clear action such as: “Transit allocation is too low for this itinerary — raise Local Transit to 15–20% or accept a higher transit category.”
   - Optionally include a one-click budget-allocation adjustment if the existing update callback can support it cleanly; otherwise provide the message and route users to Edit budget.

## Files expected to change
- `src/services/tripBudgetService.ts`
- `src/components/planner/budget/BudgetSetupDialog.tsx`
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`
- `supabase/functions/generate-itinerary/action-repair-costs.ts`
- `src/components/planner/budget/BudgetCoach.tsx`
- Possibly `src/components/planner/budget/BudgetTab.tsx` if the coach needs the raw transit allocation/usage passed in directly.

## Validation
- Confirm Splurge-Forward Local Transit allocation becomes realistic for a 4-day, 2-person Paris luxury trip: roughly $270–$360 on a $1,796 budget instead of $180.
- Confirm the Budget by Category bar uses the new percentage for newly configured Splurge-Forward budgets.
- Confirm generation prompt now contains transit-budget instructions and does not encourage taxi for every intra-city hop.
- Confirm Budget Coach no longer implies taxi swaps alone can make an impossible transit category green.