

## Fix: Minimum Duration Enforcement to Prevent Time Compression

### Problem

The repair pipeline's TIME_OVERLAP CASCADE (Step 13 in `repair-day.ts`) truncates non-structural activities when they overlap with a structural card (hotel check-in, departure transport, etc.). It sets `prev.endTime = currStart` regardless of how short that makes the activity. This is what compressed Belcanto dinner from a proper 90+ minute slot down to 15 minutes — a structural card was injected right after it, and the cascade blindly truncated.

There is **no minimum duration guard** anywhere in the pipeline.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Step 13 (TIME_OVERLAP CASCADE), around line 1566

When truncating a non-structural activity before a structural one, enforce a minimum duration based on category:

1. Define minimum durations by category:
   - `dining` / meal activities: **60 minutes**
   - `activity` / `sightseeing`: **30 minutes**
   - Everything else: **15 minutes**

2. In the truncation branch (line 1566–1576), after computing the new end time:
   - Calculate the resulting duration (`newEnd - startTime`)
   - If it falls below the minimum for that category, **shift the activity's start time earlier** to preserve the minimum duration
   - If shifting earlier would overlap with the activity *before* it, shift the structural card forward instead (same logic as the non-structural branch)
   - As a last resort, if neither shift works, keep the truncation but log a repair warning

### Code Change (conceptual)

```typescript
// Inside the isStructural(curr) branch, after line 1568:
const prevStart = parseTimeToMinutes(prev.startTime || '');
const newEnd = currStart;
const newDuration = prevStart !== null ? newEnd - prevStart : 0;

// Category-based minimum durations
const minDur = (prev.category || '').toLowerCase() === 'dining' ? 60
  : ['activity', 'sightseeing'].includes((prev.category || '').toLowerCase()) ? 30
  : 15;

if (newDuration < minDur && prevStart !== null) {
  // Try shifting prev earlier to preserve minimum duration
  const idealStart = newEnd - minDur;
  const prevPrev = i > 0 ? activities[i - 1] : null;
  const prevPrevEnd = prevPrev ? parseTimeToMinutes(prevPrev.endTime || '') : null;
  const floor = prevPrevEnd !== null ? prevPrevEnd : 0;

  if (idealStart >= floor) {
    prev.startTime = minutesToHHMM(idealStart);
    prev.endTime = minutesToHHMM(newEnd);
    repairs.push({ code: FAILURE_CODES.TIME_OVERLAP, activityIndex: i,
      action: 'shifted_earlier_for_min_duration', ... });
  } else {
    // Can't shift earlier — push structural card forward instead
    const shiftAmount = minDur - newDuration;
    for (let j = i + 1; j < activities.length; j++) {
      // shift all subsequent forward by shiftAmount
    }
    repairs.push({ ... action: 'shifted_structural_for_min_duration' ... });
  }
} else {
  // Original truncation is fine
  prev.endTime = minutesToHHMM(newEnd);
}
```

### Impact
- Dining activities will never be compressed below 60 minutes
- Sightseeing/activities never below 30 minutes
- The fix is contained to a single block in `repair-day.ts` Step 13
- No changes needed to any other pipeline stages

