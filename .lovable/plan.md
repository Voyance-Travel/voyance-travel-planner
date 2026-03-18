

## Fix: Preserve Transit Data on Adjacent Swaps

### Problem
When "Move up" swaps two adjacent activities (e.g., index 0 and 1), the code clears `transportation` on both. This triggers:
1. `handleActivityReorder` falls back to a 20-min transit gap (line 3804) when computing new times
2. The `TransitGapIndicator` auto-fetch fires and returns a real Google Routes value (7 min) that differs from the original AI-generated estimate (20m)

The user sees the duration jump from 20m to 7 min with no meaningful change.

### Root Cause
Transportation describes travel **from** the activity it's attached to **to** the next one. When two adjacent activities swap, the transportation on the **upper** activity (describing A→B) is still valid — the same two locations are adjacent, just in reverse order. Walking distance is symmetric, so the data should be preserved, not cleared.

### Fix — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`** (lines 3847-3857)

Replace the blanket clearing logic with smart preservation for adjacent swaps:

1. When swapping `actIdx` and `newIdx` (always differ by 1 for move up/down):
   - The activity that **was** at `minIdx` had transportation describing `minIdx → minIdx+1`. After swap, it's now at `maxIdx`. Its transportation is still valid (same pair, symmetric distance) — **keep it**.
   - The activity that **was** at `maxIdx` had transportation describing `maxIdx → maxIdx+1`. After swap, it's now at `minIdx`. Its next neighbor is now the other swapped activity (which it was already adjacent to) — **transfer the old minIdx transportation to it** (since it now occupies that slot and has the same next-neighbor relationship).
   - The activity at `minIdx - 1` (if exists) still points to the same slot, but the activity in that slot changed — **clear only this one**.

Simplified logic:
```
// After swap: activities[minIdx] was formerly at maxIdx, activities[maxIdx] was formerly at minIdx
// The former minIdx activity had transport data for the minIdx→maxIdx pair
// Since walk distance is symmetric, give it to the new occupant of minIdx
const formerMinTransport = originalActivities[minIdx]?.transportation;
const formerMaxTransport = originalActivities[maxIdx]?.transportation;

// New minIdx gets the old minIdx's transport (same pair, reversed)
activities[minIdx] = { ...activities[minIdx], transportation: formerMinTransport };
// New maxIdx gets the old maxIdx's transport (its next neighbor beyond the swap is unchanged)  
activities[maxIdx] = { ...activities[maxIdx], transportation: formerMaxTransport };
// Activity before the swap range has a new next neighbor — clear its transport
if (minIdx > 0) {
  activities[minIdx - 1] = { ...activities[minIdx - 1], transportation: undefined };
}
```

This preserves the "Walk 20m" data instead of clearing it and getting an inconsistent "7 min" from the API.

### What this fixes
- "Walk to X 20m" stays as "Walk to X 20m" after move up/down between the same pair
- No spurious auto-fetch API calls for unchanged pairs
- The activity before the swap range still gets cleared (its next neighbor genuinely changed)

