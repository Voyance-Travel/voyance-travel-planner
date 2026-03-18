

## Fix: Transit Connectors Auto-Recompute After Move Up/Down

### Problem

When "Move up/down" swaps activities, `handleActivityMove` clears `transportation` on both swapped activities (line 3847-3849). The `TransitGapIndicator` then falls back to a gap-time heuristic: if gap > 15 min → "Travel" with car icon, else "Walk" with footprints icon. Since `handleActivityReorder` inserts a default 20-min transit gap between activities (line 3804), the gap exceeds 15 min, causing "Walk to X 20m" to become "Travel to X 20 min" with a car/metro icon — even though nothing meaningful changed about the route.

### Root Causes

1. **Aggressive clearing**: `handleActivityMove` clears `transportation` on both swapped activities, losing known transit data
2. **Arbitrary 20-min gap**: `handleActivityReorder` uses a fixed 20-min transit gap fallback (line 3804), which inflates gaps past the 15-min walking threshold
3. **No auto-fetch**: `TransitGapIndicator` only fetches real transit data when the user manually expands it — it never auto-recomputes after a reorder

### Fix — 2 files

**1. `src/components/itinerary/TransitGapIndicator.tsx`**

Add a `useEffect` that auto-fetches a walking estimate via `route-details` when:
- `transportation` is null/undefined (was cleared after reorder)
- Valid `originName` and `destinationName` exist
- `city` is available
- Component hasn't already fetched

This sets a local walking estimate as the default display instead of relying on the broken gap-time heuristic. Uses `route-details` with `mode: 'walking'` (lightweight, no AI call).

Store the result in a local `autoTransit` state: `{ method: 'walk', duration: '12 min' }`. Use `autoTransit` as fallback when `transportation` prop is null.

**2. `src/components/itinerary/EditorialItinerary.tsx`**

In `handleActivityMove` (line 3833): instead of clearing `transportation` on both swapped activities indiscriminately, only clear transportation on activities whose **next neighbor** changed. After a swap of indices `actIdx` and `newIdx`:
- Clear transportation on the activity now at `min(actIdx, newIdx)` (its next neighbor changed)
- Clear transportation on the activity now at `max(actIdx, newIdx)` (its next neighbor changed)  
- If `min(actIdx, newIdx) > 0`, also clear transportation on the activity at `min(actIdx, newIdx) - 1` (its next neighbor is now different)

This is more precise than the current blanket clear but the real fix is the auto-fetch in point 1.

### Summary

| File | Change |
|------|--------|
| `TransitGapIndicator.tsx` | Add `useEffect` to auto-fetch walking estimate when `transportation` is null |
| `EditorialItinerary.tsx` | Refine which activities get `transportation` cleared after swap |

