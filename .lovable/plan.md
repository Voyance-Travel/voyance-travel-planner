
## Already Fixed — No Changes Needed

The multi-city per-city boundary constraints are already implemented at **lines 7738-7762** of `supabase/functions/generate-itinerary/index.ts`.

The existing code:
- Checks `paramIsFirstDayInCity` to inject check-in instructions for arrival days
- Checks `paramIsLastDayInCity` to inject checkout/departure instructions for the last day in each city
- Reinforces the correct hotel name for all multi-city days
- Correctly excludes Day 1 of the trip (`!isFirstDay`) and transition days (`!paramIsTransitionDay`) from the arrival logic
- Correctly excludes the trip's final day (`!isLastDay`) from the departure logic

No changes required.
