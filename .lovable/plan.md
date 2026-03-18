

## Fix: Move Up/Down +75 min Cascade — Root Cause Found

### Why 5 rounds of fixes haven't worked

The slot-anchored timing code IS deployed and correct in isolation. But **transport-type activities** (like "Metro to Opéra District", category `transportation`) are included in `getVisibleReorderableActivities` and participate in the timing calculation. Their durations (25 min) plus the cascading `previousEnd` logic push every downstream activity forward.

Tracing with the old cursor logic + transport rows in the visible set produces **exactly** the user's reported numbers:
- Activity A transport buffer (30 min) → cursor lands at 680 = 11:20 AM (Lunch) ✓
- Default 15 min buffer → cursor at 785 = 1:05 PM (Marché) ✓
- Metro duration 25 + buffer 15 → cursor at 910 = 3:10 PM (Palais) ✓

Every previous fix targeted the timing formula but left transport activities in the reorderable set. That's why the number never changed.

### The fix — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`**

#### 1. Exclude transport activities from `getVisibleReorderableActivities`

Add a transport-type check alongside the existing synthetic/hidden filters:

```typescript
const isTransportActivity = useCallback((a: EditorialActivity): boolean => {
  const cat = (a.category || a.type || '').toLowerCase();
  return cat === 'transportation' || cat === 'transport';
}, []);

const getVisibleReorderableActivities = useCallback((activities: EditorialActivity[]): EditorialActivity[] => {
  return activities.filter(a =>
    !isSyntheticActivity(a) &&
    !isHiddenOptionAlternative(a, activities) &&
    !isTransportActivity(a)  // NEW: skip transport rows
  );
}, [isSyntheticActivity, isHiddenOptionAlternative, isTransportActivity]);
```

This removes Metro/Walk/Taxi transport rows from the timing calculation entirely. Their durations no longer cascade into `previousEnd`.

#### 2. After reorder, update transport activity times to fit between new neighbors

In `handleActivityReorder`, after rebuilding the raw array with `finalVisible`, sweep through and adjust transport activity start/end times to sit between their surrounding non-transport activities:

```typescript
// After rebuilding `updated` array with visible slots:
// Adjust transport activities to fit between their new neighbors
for (let i = 0; i < updated.length; i++) {
  if (!isTransportActivity(updated[i])) continue;
  const prev = updated.slice(0, i).reverse().find(a => !isTransportActivity(a));
  const next = updated.slice(i + 1).find(a => !isTransportActivity(a));
  const tDur = /* parse transport's own duration */ 15;
  if (prev?.endTime) {
    const pEnd = toMins(prev.endTime) ?? 0;
    updated[i] = {
      ...updated[i],
      startTime: fmtTime(pEnd),
      endTime: fmtTime(pEnd + tDur),
      time: fmtTime(pEnd),
      transportation: undefined, // clear stale route for refetch
    };
  }
}
```

#### 3. Update `handleActivityMove` dependencies

Add `isTransportActivity` to the dependency arrays of both `handleActivityMove` and `handleActivityReorder`.

### Expected result

- Move Up on Lunch swaps with Marché (transport rows are skipped)
- Slot-anchored timing only considers: [Activity A, Lunch, Marché, Palais]
- No transport durations in the cascade → Palais stays near its original 1:55 PM
- Transport rows retain their visual rendering (compact transit indicators) and get their times adjusted to fit the gap
- TransitGapIndicator auto-fetches updated walking/transit estimates for new neighbor pairs

