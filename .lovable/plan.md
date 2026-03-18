
Fix: Move Up timing is still using transport durations as schedule inputs, so the UI route label improves but the saved itinerary times stay inflated.

What’s actually still broken
- The visible-only reorder scaffold is in place, and the route row now refetches the correct direction.
- But `handleActivityReorder` still rebuilds the day from a moving `cursor` and adds `activity.transportation?.duration ?? 15` between reordered cards.
- That means the schedule engine is using transport metadata as a hard timing source. When transport was cleared for refetch, it falls back to `15` minutes; when transport is stale, it uses stale values. The later 2-minute walk refetch only updates the transit row UI, not the already-saved activity times.
- This is why Palais Garnier keeps landing at `3:10 PM`: the reorder pass is still injecting synthetic gap time during recompute.

Implementation plan

1. `src/components/itinerary/EditorialItinerary.tsx`
- Replace the current cursor-based timing logic inside `handleActivityReorder`.
- Stop using:
  - earliest visible start as a global cursor anchor
  - `parseTransitDuration(activity.transportation?.duration) ?? 15`
- Transport rows should not be schedule source-of-truth during reorder.

2. `src/components/itinerary/EditorialItinerary.tsx`
- Rebuild reordered times using original visible time slots instead:
  - capture the original visible start times before reorder
  - assign reordered activities into those slots in order
  - compute each item as:
    - `preferredStart = originalVisibleSlotStart[i]`
    - `actualStart = max(preferredStart, previousEnd)`
    - `actualEnd = actualStart + activityDuration`
- This preserves downstream anchors unless a moved item truly overruns the next slot.
- In the reported case, Lunch should inherit Marché’s old slot, Marché should inherit Lunch’s slot, and Palais should remain near its original `1:55 PM`.

3. `src/components/itinerary/EditorialItinerary.tsx`
- Keep the current visible-only scaffold rebuild and adjacency-based `transportation` clearing.
- But limit timing shifts to real overlap overflow only; do not add guessed transport buffers during reorder.
- Continue clearing transport for changed neighbor pairs so `TransitGapIndicator` can refetch the new route direction.

4. `src/components/itinerary/EditorialItinerary.tsx`
- Update Move Up / Move Down button disabling to use visible position instead of raw `activityIndex`.
- The current menu still disables based on raw indices, which can drift from the visible order when option-group items exist.

Technical details
- Current failing logic is the block in `handleActivityReorder` that does:
  - `cursor = min(original visible starts)`
  - `cursor += duration + transportDurationOr15`
- That is the remaining source of the persistent `+75 min` inflation.
- The route label improvement confirms the transport refetch layer is working; the bug is now isolated to schedule recomputation, not route lookup.
- The safest fix is “slot-anchored reorder”:
```text
old visible starts:  [10:50, 12:00, 13:55]
new visible order:   [Lunch, Marché, Palais]

Lunch   -> start 10:50
Marché  -> start max(12:00, Lunch.end)
Palais  -> start max(13:55, Marché.end)
```
- This preserves the original day structure and prevents transport metadata from becoming phantom schedule time.

Expected result
- Moving Lunch above Marché swaps the activities without injecting extra 15/25-minute timing debt into the whole suffix.
- The transit row can still update to the new 2-minute walk.
- Palais Garnier should stay approximately at its original start time instead of drifting to `3:10 PM`.
