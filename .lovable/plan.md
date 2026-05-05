## Plan

I’ll make the Budget Coach treat a hotel-only / no-activity itinerary as a terminal empty state, not as an over-budget itinerary that needs swaps.

## What will change

1. **Use a stricter “bookable activity” guard**
   - Add a shared helper inside `BudgetCoach.tsx` that identifies live bookable/suggestable activities.
   - Exclude hotels, flights, check-in/out, bag drop, return-to-hotel/freshen-up rituals, transfers/logistics, free/$0 items, locked items, and generic placeholders.
   - The Coach will only generate savings advice if at least one current activity passes this guard.

2. **Replace the empty-state copy exactly**
   - When the active itinerary has no bookable activities, the Coach will suppress all swap/drop language and show a single prompt:
     - “Your itinerary looks empty — add activities to get personalized savings advice.”
   - It will not show “Drop optional activities,” “Remove activities,” “Swaps alone won’t bridge this gap,” or “Get Suggestions” in that state.

3. **Hard-flush stale suggestions on itinerary collapse**
   - When the live bookable activity count becomes zero:
     - Clear component suggestions.
     - Clear the module-level suggestion cache for that trip.
     - Clear the in-flight request marker.
     - Reset the auto-fetch guard.
   - This prevents previous itinerary suggestions from persisting after regeneration produces hotel-only days.

4. **Discard AI responses if the itinerary changes while loading**
   - Strengthen the race guard so a response started against the old itinerary cannot write suggestions after the itinerary has regenerated to empty.
   - The response will be accepted only if the current live bookable activity ID hash still matches the request hash.

5. **Backend no-candidates response cleanup**
   - Adjust `budget-coach/index.ts` so an empty post-filtered payload returns `no_candidates: true`, not `all_protected: true` unless the only reason candidates disappeared is actual protections.
   - Add explicit non-suggestable/logistics filtering on the backend too, so any caller that accidentally sends hotel/logistics rows still gets `suggestions: []`.
   - If all AI suggestions are post-filtered out, return `filtered_empty/no_candidates` metadata and never imply usable swaps exist.

6. **Keep Budget Tab warning aligned**
   - Update the existing bare-itinerary warning in `BudgetTab.tsx` to use the same “meaningful/bookable activity” logic as the Coach, so the tab and Coach agree on whether the itinerary is empty.

## Validation

After implementation, I’ll verify the code paths for:

- Hotel-only itinerary: no Budget Coach AI call, no cached suggestions, only the empty-itinerary prompt.
- Regeneration from non-empty to empty: old restaurants/activities are cleared and cannot render.
- In-flight stale request: suggestions from the old itinerary are discarded if the live activity hash changed.
- Normal over-budget itinerary with paid activities: Coach still fetches and displays valid suggestions.
- Backend empty/all-logistics payload: returns `suggestions: []` with `no_candidates: true`.