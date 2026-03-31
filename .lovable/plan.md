

## Fix: Collapse Back-to-Back Transport Activities

### Problem
Itineraries frequently show consecutive transport cards (e.g., "Walk to metro station" → "Metro to Colosseum") instead of a single transport-to-destination card. This happens because:

1. The AI prompt asks for transit between **every pair** of activities, and the AI sometimes generates multi-leg transport as separate cards
2. The `repairBookends` function (step 3) injects additional transit gap cards
3. **No existing repair step detects or collapses consecutive transport activities**

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Add a transport consolidation pass inside `repairBookends`, run **before** the transit-gap injection (step 3). This pass scans for consecutive transport activities and merges them into a single card that keeps the final destination:

```typescript
// NEW — Collapse consecutive transport cards into one
const consolidated: any[] = [];
for (let i = 0; i < activities.length; i++) {
  if (isTransport(activities[i])) {
    // Look ahead for consecutive transports
    let j = i;
    while (j + 1 < activities.length && isTransport(activities[j + 1])) j++;
    if (j > i) {
      // Merge: keep last card's destination/title, first card's startTime, last card's endTime
      const first = activities[i];
      const last = activities[j];
      const merged = {
        ...last,
        startTime: first.startTime,
        description: `Transit to ${last.location?.name || last.title}`,
      };
      consolidated.push(merged);
      repairs.push({ code: FAILURE_CODES.DUPLICATE_TITLE, action: 'collapsed_consecutive_transport', before: `${j - i + 1} transport cards`, after: merged.title });
      i = j; // skip merged cards
    } else {
      consolidated.push(activities[i]);
    }
  } else {
    consolidated.push(activities[i]);
  }
}
activities = consolidated;
```

This runs right before the existing step 3 ("Transit gaps between non-adjacent visible activities"), so the gap injector sees a clean list without back-to-back transports.

### Summary

| File | Change |
|---|---|
| `repair-day.ts` | Add transport consolidation pass in `repairBookends` to merge consecutive transport cards into one destination-focused card |

