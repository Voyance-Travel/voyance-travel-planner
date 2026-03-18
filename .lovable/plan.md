

## Fix: Move Up/Down & Drag Reorder — Incorrect Transit Recalculation

### Problem

When "Move Up" (or Move Down, or drag-and-drop) reorders activities, two bugs in `handleActivityReorder` and `handleActivityMove` cause incorrect transit gaps and cascading time errors:

**Bug 1 — Transit gap reads the WRONG activity's transportation data** (`handleActivityReorder`, line 3822-3823)

The code uses `nextActivity?.transportation?.duration` as the gap after the current activity. But `activity.transportation` describes the route FROM that activity TO its next neighbor. So the gap after activity[i] should use `withTimes[idx].activity.transportation?.duration`, not the next activity's. This flips transit durations between pairs, inflating some gaps and zeroing others.

**Bug 2 — Transportation preservation after swap is incorrect** (`handleActivityMove`, lines 3863-3880)

The swap logic tries to be clever about preserving transport data between swapped activities, but the `transportation` field describes direction-specific routes (A→B is not the same as B→A in a city). After a swap, both swapped activities have new neighbors, so the old transport data is stale. The code also only clears `minIdx-1`'s transport but leaves `maxIdx`'s transport pointing at a now-different next neighbor.

**Bug 3 — 20 min default gap is excessive**

When no transportation duration exists, the fallback is 20 minutes. For adjacent activities at the same location, this inflates the schedule by 20 min per pair.

### Plan — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`** — two functions to fix:

#### 1. Fix `handleActivityReorder` (lines 3816-3832)

Change the transit gap calculation to use the CURRENT activity's transportation duration (not the next one's):

```typescript
// BEFORE (wrong):
const nextActivity = withTimes[idx + 1]?.activity;
const transitGap = parseTransitDuration(nextActivity?.transportation?.duration) ?? 20;

// AFTER (correct):
const transitGap = (idx < withTimes.length - 1)
  ? (parseTransitDuration(activity.transportation?.duration) ?? 15)
  : 0;
```

Also reduce the default from 20 to 15 min (the standard buffer used elsewhere in the codebase).

#### 2. Fix `handleActivityMove` (lines 3863-3880)

After swapping two adjacent activities, ALL transport data between the swapped pair and their new neighbors is stale. Replace the complex "symmetric preservation" logic with a simpler approach: clear transportation on both swapped activities and on their immediate neighbors (the activity before the swap range). The `TransitGapIndicator` component already has auto-fetch logic that will re-fetch walking estimates when `transportation` is null, so the UI will self-heal.

```typescript
// Swap positions
[activities[actIdx], activities[newIdx]] = [activities[newIdx], activities[actIdx]];

// Clear stale transport data for affected positions
// minIdx's transport described old-minIdx → old-maxIdx (now invalid)
activities[minIdx] = { ...activities[minIdx], transportation: undefined };
// maxIdx's transport described old-maxIdx → next (now invalid since occupant changed)
activities[maxIdx] = { ...activities[maxIdx], transportation: undefined };
// Activity before swap range now points to a different next neighbor
if (minIdx > 0) {
  activities[minIdx - 1] = { ...activities[minIdx - 1], transportation: undefined };
}
```

### Result

- Reordering preserves each activity's original duration and only adds realistic transit gaps (from the current activity's known transport data, or a 15 min default)
- Stale transit connectors are cleared after swaps, letting the auto-fetch mechanism in `TransitGapIndicator` re-populate correct walking estimates
- All three reorder paths (Move Up, Move Down, drag-and-drop) use the same corrected logic via `handleActivityReorder`

