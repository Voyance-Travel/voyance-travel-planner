

# Fix: Transport Card Misalignment and Back-to-Back Hotel Travel

## Problem
1. **Transport cards are off by one position** — e.g., "Travel to Louvre" appears before "Café Breakfast" instead of before the Louvre activity
2. **Back-to-back hotel travel cards** — two consecutive "Travel to Your Hotel" cards appear in the itinerary

## Root Cause
The repair pipeline in `repair-day.ts` builds transport cards correctly in the `repairBookends` function (step 9), but then step 13 (TIME_OVERLAP CASCADE, line 2252) **sorts all activities by startTime**. This sort can displace transport cards from their intended neighbors. After the sort, transport destinations no longer match the actual next activity.

Additionally, the transport consolidation (step 4c) only runs inside `repairBookends`, so any transport cards created or shuffled by later steps (dedup passes, time-sort) are never consolidated.

## Solution
Add a **final transport coherence pass** at the end of `repairDay()`, right before the return statement (after step 14, ~line 2546). This pass:

1. **Rewrites misaligned transport cards** — for each transport card, checks if its destination matches the next non-transport activity. If not, rewrites title/location/fromLocation to correctly bridge prev→next neighbors.
2. **Merges consecutive transport cards** — if two transports end up adjacent (e.g., two hotel-bound transports), merge them into one.
3. **Removes redundant transports** — if a transport goes from location A to location A (same place), remove it.

### Implementation detail

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — insert after step 14 (line ~2545), before the return statement:

```typescript
// --- 15. FINAL TRANSPORT COHERENCE PASS ---
// After all repairs (including time-sort), transport cards may no longer
// bridge their actual neighbors. Rewrite destinations and merge duplicates.
{
  const isTransportFinal = (a: any) => {
    const c = (a.category || '').toLowerCase();
    return c === 'transport' || c === 'transportation';
  };

  // 15a. Rewrite each transport to match actual prev→next neighbors
  for (let i = 0; i < activities.length; i++) {
    if (!isTransportFinal(activities[i])) continue;
    const transport = activities[i];

    let prevReal: any = null;
    for (let j = i - 1; j >= 0; j--) {
      if (!isTransportFinal(activities[j])) { prevReal = activities[j]; break; }
    }
    let nextReal: any = null;
    for (let j = i + 1; j < activities.length; j++) {
      if (!isTransportFinal(activities[j])) { nextReal = activities[j]; break; }
    }
    if (!nextReal) continue;

    const transportDest = (transport.location?.name || '').toLowerCase();
    const nextLoc = (nextReal.location?.name || nextReal.title || '').toLowerCase();

    if (transportDest && nextLoc && !isSameOrContainedLocation(transportDest, nextLoc, hotelName)) {
      const fromName = prevReal?.location?.name || prevReal?.title || 'previous location';
      const toName = nextReal.location?.name || sanitizeTransitDestination(nextReal.title || '');
      transport.title = `Travel to ${toName}`;
      transport.description = `Transit from ${fromName} to ${toName}.`;
      transport.location = { name: toName, address: nextReal.location?.address || '' };
      transport.fromLocation = { name: fromName, address: prevReal?.location?.address || '' };
      // Re-estimate duration with coordinates
      const fromCoords = prevReal ? getActivityCoords(prevReal) : hotelCoordinates || null;
      const toCoords = getActivityCoords(nextReal);
      if (fromCoords && toCoords) {
        const est = estimateTransit(fromCoords, toCoords, resolvedDestination);
        transport.durationMinutes = est.durationMinutes;
        transport.endTime = addMinutesToHHMM(transport.startTime, est.durationMinutes);
        transport.cost = { amount: est.costAmount, currency: 'USD' };
        if (transport.transportation) {
          transport.transportation = { method: est.method, duration: `${est.durationMinutes} min` };
        }
      }
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'final_transport_realign', before: transportDest, after: toName });
    }
  }

  // 15b. Merge consecutive transport cards
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < activities.length - 1; i++) {
      if (isTransportFinal(activities[i]) && isTransportFinal(activities[i + 1])) {
        // Keep the second (closer to destination), remove first
        const first = activities[i];
        const second = activities[i + 1];
        second.startTime = first.startTime || second.startTime;
        // Find actual endpoints for re-estimation
        let prevReal: any = null;
        for (let j = i - 1; j >= 0; j--) {
          if (!isTransportFinal(activities[j])) { prevReal = activities[j]; break; }
        }
        const fromName = prevReal?.location?.name || first.fromLocation?.name || 'previous location';
        second.fromLocation = { name: fromName, address: '' };
        second.description = `Transit from ${fromName} to ${second.location?.name || 'destination'}.`;
        activities.splice(i, 1);
        repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'final_merge_consecutive_transport', before: first.title, after: second.title });
        merged = true;
        break;
      }
    }
  }

  // 15c. Remove self-referencing transports (from A to A)
  activities = activities.filter((act, i) => {
    if (!isTransportFinal(act)) return true;
    const from = (act.fromLocation?.name || '').toLowerCase();
    const to = (act.location?.name || '').toLowerCase();
    if (from && to && isSameOrContainedLocation(from, to, hotelName)) {
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_self_referencing_transport', before: act.title });
      return false;
    }
    return true;
  });
}
```

## Files to modify
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add step 15 (final transport coherence pass) after step 14

## What this does NOT change
- No changes to timing, durations, or activity ordering
- No changes to non-transport activities
- No new files created
- Existing transport logic untouched — this is an additive final safety net

