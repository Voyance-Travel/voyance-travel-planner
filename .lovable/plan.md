

## Fix: Move Up/Down Still Broken — Synthetic Activities Corrupt Time Recalculation

### Root Cause (NEW — not the same as previous fix)

The previous fix correctly addressed which activity's transportation duration to use and stale transport clearing. But the **real** cause of the cascade errors was never fixed:

**`handleActivityMove` and `handleActivityReorder` operate on the raw `day.activities` array, which includes synthetic/pinned items** — hotel checkouts, inter-city transport cards, departure cards, hidden option-group alternatives. These items:

1. **Corrupt swap targets**: "Move Up" swaps with `actIdx - 1` in the raw array. If `actIdx - 1` is a synthetic hotel-checkout card, the user's activity swaps with an invisible card, producing no visible change or swapping with the wrong neighbor.

2. **Inflate time recalculation**: `handleActivityReorder` iterates ALL items. Synthetic cards without proper start/end times get a **30-min default duration + 15-min transit fallback = 45 min** of phantom time per synthetic card. Three synthetic cards = 135 min of unexplained cascade shift.

3. **Wrong cursor start**: The earliest start time is computed across ALL activities including hotel checkouts (e.g., 10:00 AM), which resets the cursor and shifts everything.

This explains both test failures:
- **Test 1**: Swapping with or past a synthetic card changes the sequence without visual effect, then auto-fetch returns a different walking estimate (7 min vs 20 min) because the neighbors changed in the underlying array.
- **Test 2**: 150-min cascade = synthetic cards injecting phantom duration + transit gaps into the time cursor.

### Plan — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`** — three changes:

#### 1. Add `isSyntheticActivity` helper (above `handleActivityReorder`)

Centralizes detection of non-reorderable items using the same markers already used elsewhere in the file (lines 1640-1643):

```typescript
const isSyntheticActivity = (a: EditorialActivity): boolean =>
  !!(a as any).__syntheticTravel || !!(a as any).__syntheticDeparture ||
  !!(a as any).__syntheticFinalDeparture || !!(a as any).__interCityTransport ||
  !!(a as any).__hotelCheckout || !!(a as any).__hotelCheckin ||
  a.id.startsWith('hotel-') || a.id.startsWith('departure-') ||
  a.id.startsWith('travel-') || a.id.startsWith('final-departure-');
```

#### 2. Fix `handleActivityMove` — skip synthetic neighbors

Instead of `actIdx - 1` / `actIdx + 1`, scan for the next visible, non-synthetic activity:

```typescript
// Find visible neighbor to swap with (skip synthetic/hidden items)
let newIdx = direction === 'up' ? actIdx - 1 : actIdx + 1;
while (newIdx >= 0 && newIdx < activities.length && isSyntheticActivity(activities[newIdx])) {
  newIdx += direction === 'up' ? -1 : 1;
}
if (newIdx < 0 || newIdx >= activities.length) return;
```

Also skip if the source activity itself is synthetic (shouldn't happen but defensive).

#### 3. Fix `handleActivityReorder` — exclude synthetic items from time recalculation

Partition activities into synthetic (preserve original times) and real (recalculate times):

```typescript
// Separate synthetic items — they keep their original times and don't affect cursor
const realActivities = reorderedActivities.filter(a => !isSyntheticActivity(a));
const syntheticSet = new Set(reorderedActivities.filter(a => isSyntheticActivity(a)).map(a => a.id));

// Only compute withTimes / cursor / transit gaps for realActivities
// ... existing cursor logic but on realActivities only ...

// Merge back: for each activity in the original order, use recalculated time if real, original time if synthetic
const updatedMap = new Map(realUpdated.map(a => [a.id, a]));
const updated = reorderedActivities.map(a => 
  syntheticSet.has(a.id) ? a : (updatedMap.get(a.id) || a)
);
```

### Result

- Move Up/Down skips synthetic cards (hotel checkout, travel summaries) and swaps with the correct visible neighbor
- Time recalculation ignores synthetic items — no phantom 30+15 min gaps per invisible card
- Drag-and-drop also benefits since it flows through `handleActivityReorder`
- Synthetic cards retain their original times and positions relative to real activities

