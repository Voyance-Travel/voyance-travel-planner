

## Fix: Add TIME_OVERLAP Repair to Post-Generation Pipeline

### Problem

`validate-day.ts` detects `TIME_OVERLAP` (line 273-289) and marks it `autoRepairable: true`, but `repair-day.ts` has **no handler** for this failure code. Overlaps survive into the final itinerary.

Two specific patterns cause this:
1. **Injected activities collide** — repair-day injects hotel check-in, freshen-up, checkout, etc. at fixed times without checking for collisions with existing activities (e.g., "Freshen up" and "Dinner" both at 7:15 PM).
2. **Structural activities overlap user activities** — checkout injected at 11:00 AM while "Stroll" runs until 11:25 AM. The stroll should be truncated or shifted to end before checkout.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Add a `TIME_OVERLAP` cascade repair as a **final step** (after all injections — check-in, checkout, bookends, departure sequence). This ensures it catches overlaps introduced by earlier repair steps.

The cascade logic:
1. Sort activities by `startTime`
2. Walk the list sequentially; for each pair where `prev.endTime > curr.startTime`:
   - If `curr` is a **structural/locked activity** (checkout, departure, transport, locked), **truncate** the previous activity's `endTime` to match `curr.startTime`
   - Otherwise, **shift** `curr.startTime` to `prev.endTime` and push `curr.endTime` forward by the same delta
3. After shifting, continue cascading forward through remaining activities
4. Clamp any activity pushed past 23:59 — drop it if its start exceeds 23:30
5. Log each repair action

This mirrors the existing `cascadeFixOverlaps` logic in `injectHotelActivities.ts` but operates on the backend pipeline's data shape and respects locked/structural priority.

Insert after the final existing repair step (step 12, NON-FLIGHT DEPARTURE) and before the return statement.

```typescript
// --- 13. TIME_OVERLAP CASCADE (final pass — catches overlaps from all prior injections) ---
{
  activities.sort((a: any, b: any) => {
    const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
    const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
    return ta - tb;
  });

  const STRUCTURAL_CATS = ['accommodation', 'transport', 'logistics'];
  const STRUCTURAL_KW = ['checkout', 'check-out', 'check out', 'departure', 'airport', 'flight'];

  const isStructural = (act: any) => {
    const cat = (act.category || '').toLowerCase();
    const title = (act.title || '').toLowerCase();
    return STRUCTURAL_CATS.includes(cat) ||
      STRUCTURAL_KW.some(kw => title.includes(kw)) ||
      lockedIds.has(act.id);
  };

  for (let i = 0; i < activities.length - 1; i++) {
    const prev = activities[i];
    const curr = activities[i + 1];
    const prevEnd = parseTimeToMinutes(prev.endTime || '');
    const currStart = parseTimeToMinutes(curr.startTime || '');
    if (prevEnd === null || currStart === null || currStart >= prevEnd) continue;

    const overlapMins = prevEnd - currStart;

    if (isStructural(curr)) {
      // Truncate prev to end before structural activity
      prev.endTime = minutesToHHMM(currStart);
      repairs.push({
        code: FAILURE_CODES.TIME_OVERLAP,
        activityIndex: i,
        action: 'truncated_before_structural',
        before: `${prev.title} end ${minutesToHHMM(prevEnd)}`,
        after: `${prev.title} end ${curr.startTime}`,
      });
    } else {
      // Shift curr (and all subsequent) forward
      for (let j = i + 1; j < activities.length; j++) {
        const s = parseTimeToMinutes(activities[j].startTime || '');
        const e = parseTimeToMinutes(activities[j].endTime || '');
        if (s !== null) activities[j].startTime = minutesToHHMM(s + overlapMins);
        if (e !== null) activities[j].endTime = minutesToHHMM(e + overlapMins);
      }
      repairs.push({
        code: FAILURE_CODES.TIME_OVERLAP,
        activityIndex: i + 1,
        action: 'shifted_forward',
        before: `${curr.title} start ${minutesToHHMM(currStart)}`,
        after: `${curr.title} start ${minutesToHHMM(currStart + overlapMins)}`,
      });
    }
  }

  // Drop activities pushed past 23:30
  const cutoff = 23 * 60 + 30;
  activities = activities.filter((act: any) => {
    const s = parseTimeToMinutes(act.startTime || '');
    if (s !== null && s > cutoff) {
      repairs.push({
        code: FAILURE_CODES.TIME_OVERLAP,
        action: 'dropped_past_midnight',
        before: act.title,
      });
      return false;
    }
    return true;
  });
}
```

### Summary

| File | Change |
|---|---|
| `supabase/functions/generate-itinerary/pipeline/repair-day.ts` | Add step 13: `TIME_OVERLAP` cascade — truncate before structural activities, shift non-structural forward, drop past-midnight |

