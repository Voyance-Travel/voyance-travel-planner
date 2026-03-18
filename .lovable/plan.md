
Fix: Move Up still recalculates against the raw activity array instead of the visible card order

What’s actually still broken
- The previous fix removed synthetic travel/check-in/out cards from reorder timing, but hidden option-group alternatives are still treated as real activities during reordering.
- In `EditorialItinerary.tsx`, the day UI renders a visible subset of `day.activities`:
  - selected option in each `optionGroup`
  - all normal activities
  - synthetic cards rendered separately
- But `handleActivityMove` and `handleActivityReorder` still operate on the raw `day.activities` array and only skip synthetic items. That means hidden alternatives can still:
  - become swap targets
  - inject phantom duration/gap time into the cursor
  - preserve stale `transportation` on the wrong segment
- There is also a transit refresh gap: `TransitGapIndicator.tsx` keeps `autoTransit`/`autoFetchAttempted` when the route endpoints change while `transportation` remains undefined, so reordered rows can reuse stale walking estimates.

Implementation plan

1. `src/components/itinerary/EditorialItinerary.tsx`
- Add a helper for hidden alternatives:
  - `isHiddenOptionAlternative(activity, activities, optionSelections)`
- Add a visible-order helper:
  - `getVisibleReorderableActivities(activities, optionSelections)`
  - includes only cards the user can actually move in the menu: selected option-group cards + normal cards
  - excludes synthetic cards and non-selected alternatives
- Rework `handleActivityMove` to:
  - build the visible reorderable list
  - move by visible position only
  - never swap with raw hidden entries
  - pass the reordered visible list into a shared reorder helper

2. `src/components/itinerary/EditorialItinerary.tsx`
- Rework `handleActivityReorder` so it no longer trusts raw reordered arrays.
- New behavior:
  - derive old visible order from current `day.activities`
  - derive requested visible order from the move/drag result
  - rebuild the raw day array by replacing only visible reorderable slots, while leaving:
    - synthetic cards
    - hidden option alternatives
    - other non-visible entries
    in place
  - recalculate times only across the visible reorderable activities
  - merge those recalculated times back into the rebuilt raw array
- Also compare old vs new visible adjacency and clear `transportation` only for activities whose next visible neighbor changed. That makes route refetch direction-aware without letting stale segments survive.

3. `src/components/itinerary/EditorialItinerary.tsx`
- Pass visible position / move availability into `ActivityRow` instead of relying on raw `activityIndex`.
- Update Move Up / Move Down disabled logic to follow the visible card order the user sees, not the underlying raw array.

4. `src/components/itinerary/TransitGapIndicator.tsx`
- Reset `autoTransit` and the fetch guard when `originName`, `destinationName`, or `city` changes.
- This ensures a reordered segment refetches the new route instead of keeping an old walk estimate attached to a previous direction.

Technical details
- The key bug is the mismatch between:
  - render-time visible sequence (`findNextVisibleActivity`, selected `optionGroup` item)
  - reorder-time raw sequence (`day.activities`)
- The safest fix is to treat the raw day array as a scaffold and only reorder the visible movable slots inside it.
- That preserves hidden alternatives for later option switching, while keeping time math and transport refresh aligned to the user-visible itinerary.

Expected result
- “Move Up” on Lunch swaps only with the visible card above it.
- Hidden alternatives no longer add phantom 30/45/75 minute cascades.
- Transit rows refetch for the new visible segment direction after reorder.
- Palais Garnier should stay near its original start time instead of drifting by +75 min from invisible raw entries.
