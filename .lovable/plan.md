

## Fix: "Move Up/Down" Doesn't Reassign Times or Transportation

### Root Cause

`handleActivityMove` (line 3738) performs a simple array swap of two activities but:
1. **Does not reassign `startTime`/`endTime`** — the swapped activities keep their original times, creating a logically incorrect schedule
2. **Does not clear or swap `transportation` data** — each activity's `.transportation` field describes transit *from that activity to the next*. After swapping, this data now describes the wrong A→B pair, producing the "110 min" phantom transit time

Meanwhile, `handleActivityReorder` (used by drag-and-drop) correctly reassigns all times and uses transit durations for gap calculation. The "Move Up/Down" button should use the same logic.

### Fix — 1 file: `src/components/itinerary/EditorialItinerary.tsx`

**Replace `handleActivityMove`** (lines 3738-3752) to delegate to `handleActivityReorder` instead of doing a raw swap:

```typescript
const handleActivityMove = useCallback((dayIndex: number, activityId: string, direction: 'up' | 'down') => {
  const day = days[dayIndex];
  if (!day) return;
  
  const activities = [...day.activities];
  const actIdx = activities.findIndex(a => a.id === activityId);
  if (actIdx === -1) return;
  
  const newIdx = direction === 'up' ? actIdx - 1 : actIdx + 1;
  if (newIdx < 0 || newIdx >= activities.length) return;
  
  // Swap positions
  [activities[actIdx], activities[newIdx]] = [activities[newIdx], activities[actIdx]];
  
  // Clear stale transportation on swapped activities so TransitGapIndicator re-fetches
  activities[actIdx] = { ...activities[actIdx], transportation: undefined };
  activities[newIdx] = { ...activities[newIdx], transportation: undefined };
  
  // Delegate to reorder handler which reassigns times properly
  handleActivityReorder(dayIndex, activities);
}, [days, handleActivityReorder]);
```

This ensures:
- Times are recalculated sequentially (same as drag-and-drop)
- Stale transportation data is cleared so the transit connector shows fresh estimates
- Version snapshot is saved (handled inside `handleActivityReorder`) for undo support

