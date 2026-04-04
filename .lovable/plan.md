

## Fix: Large Gap Detection and Closure in Repair Pipeline

### Problem

The repair pipeline has no step that detects or closes large unexplained gaps between consecutive activities. When the AI generates a "Freshen Up" ending at 20:39 and a "Nightcap" starting at 22:34, that 115-minute gap passes through all 18 repair steps unchallenged — no validator flags it, no repair closes it.

The pipeline handles overlaps (Step 13) and missing transits (Step 9d), but never asks: "Is there dead time here that shouldn't exist?"

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — Add a new step after Step 13 (TIME_OVERLAP CASCADE) and before Step 14 (DEPARTURE DAY PRUNE).

**New Step: GAP CLOSURE** — scans consecutive non-transport activity pairs and closes gaps exceeding a threshold by shifting the later activity (and all subsequent) earlier.

#### Logic

1. Walk consecutive pairs of activities (skipping transport cards, which are just connectors)
2. For each pair, compute the gap: `nextStart - prevEnd`
3. Define a max acceptable gap:
   - Between accommodation → dining/activity: **45 minutes** (realistic freshen-up-to-dinner transition including transport)
   - Between any other pair: **60 minutes** (allows for unstated transit)
4. If the gap exceeds the threshold:
   - Calculate the shift amount: `gap - maxGap` (close the gap down to the threshold, not to zero)
   - Shift the later activity and all subsequent activities earlier by that amount
   - Ensure no activity gets shifted before its predecessor's end time
   - Log a repair action

#### Conceptual code

```typescript
// --- Step 13b. GAP CLOSURE ---
{
  for (let i = 0; i < activities.length - 1; i++) {
    const curr = activities[i];
    const next = activities[i + 1];
    
    // Skip transport pairs — they're connectors, not real gaps
    if ((curr.category || '').toLowerCase() === 'transport') continue;
    if ((next.category || '').toLowerCase() === 'transport') continue;
    
    const currEnd = parseTimeToMinutes(curr.endTime || '');
    const nextStart = parseTimeToMinutes(next.startTime || '');
    if (currEnd === null || nextStart === null) continue;
    
    const gap = nextStart - currEnd;
    
    // Determine max acceptable gap based on context
    const currCat = (curr.category || '').toLowerCase();
    const maxGap = currCat === 'accommodation' ? 45 : 60;
    
    if (gap > maxGap) {
      const shift = gap - maxGap;
      // Shift this activity and all subsequent earlier
      for (let j = i + 1; j < activities.length; j++) {
        const s = parseTimeToMinutes(activities[j].startTime || '');
        const e = parseTimeToMinutes(activities[j].endTime || '');
        if (s !== null) activities[j].startTime = minutesToHHMM(s - shift);
        if (e !== null) activities[j].endTime = minutesToHHMM(e - shift);
      }
      repairs.push({
        code: FAILURE_CODES.TIME_OVERLAP,
        activityIndex: i + 1,
        action: 'closed_excessive_gap',
        before: `${gap}min gap between "${curr.title}" and "${next.title}"`,
        after: `Closed to ${maxGap}min, shifted ${next.title} and subsequent -${shift}min`,
      });
    }
  }
}
```

#### Safeguards

- Only shifts activities earlier, never creates new overlaps (the overlap cascade already ran)
- Preserves transport cards between activities (they shift with everything else)
- Does not touch locked activities
- Runs after overlap resolution so it doesn't undo those fixes
- Keeps a reasonable buffer (45–60 min) rather than jamming activities together

### Impact
- Eliminates unexplained 2-hour dead gaps like the Freshen Up → Nightcap scenario
- Single new block in `repair-day.ts`, no other files affected
- Conservative thresholds prevent over-packing the day

