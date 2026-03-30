

## Fix: Update Transit Card When Restaurant Is Swapped by Dedup

### Problem

When `repair-day.ts` step 4 (DUPLICATE_CONCEPT) swaps a dining activity from the restaurant pool, it updates the dining activity's title and location but **does not update the preceding transport card**. The transport card still references the original restaurant name (e.g., "Travel to A Beccafico") while the dining activity now points to the replacement (e.g., "Dinner at Quadri").

### Root Cause

`repair-day.ts` lines 217-231: after swapping the restaurant, the code does `continue` without checking if `activities[vr.activityIndex - 1]` is a transport card that references the old venue.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** (~line 222, after the swap updates the dining activity)

After updating the dining activity's title/location/description, check if the immediately preceding activity is a transport card. If so, update its title and location to reference the new restaurant:

```typescript
if (replacement) {
  const before = act.title;
  act.title = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${replacement.name}`;
  act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}. ${replacement.priceRange || '$$'}.`;
  act.location = { name: replacement.name, address: replacement.address || '' };
  act.source = 'pool-dedup-swap';
  usedSet.add(normalizeForDedup(replacement.name));

  // ── NEW: sync preceding transport card ──
  const prevIdx = vr.activityIndex - 1;
  if (prevIdx >= 0) {
    const prev = activities[prevIdx];
    if ((prev.category || '').toLowerCase() === 'transport' &&
        !lockedIds.has(prev.id)) {
      const oldTitle = prev.title;
      prev.title = `Travel to ${replacement.name}`;
      prev.location = { name: replacement.name, address: replacement.address || '' };
      if (prev.description) {
        prev.description = prev.description.replace(/to\s+.+\.?$/, `to ${replacement.name}.`);
      }
      repairs.push({
        code: FAILURE_CODES.DUPLICATE_CONCEPT,
        activityIndex: prevIdx,
        action: 'synced_transit_after_swap',
        before: oldTitle,
        after: prev.title,
      });
    }
  }

  repairs.push({
    code: FAILURE_CODES.DUPLICATE_CONCEPT,
    activityIndex: vr.activityIndex,
    action: 'swapped_from_pool',
    before,
    after: act.title,
  });
  continue;
}
```

Single insertion point, no other files affected.

### Summary

| File | Change |
|---|---|
| `repair-day.ts` | After pool-swap of a dining dupe, update the preceding transport card's title and location to match the new restaurant |

