

## Fix: Timing Overlaps & Impossible Sequences

Three root causes produce the timing issues the user sees. All are in the generation backend.

---

### Root Cause 1: Stage 2.7 only enforces a 5-minute gap

`MIN_OVERLAP_GAP = 5` at line 6711 means after AI generation, any overlap is "fixed" by pushing the next activity forward just 5 minutes. But the personalization system already computed a proper buffer (20-60 min depending on pace). The result: activities end up 5 minutes apart instead of 20-30 minutes.

**Fix (index.ts, Stage 2.7 ~line 6711):**
- Replace `const MIN_OVERLAP_GAP = 5` with the actual `scheduleConstraints.bufferMinutesBetweenActivities` value
- The `scheduleConstraints` variable is already in scope (computed at Stage 1.96)
- This single change means the overlap fixer uses 20-60 min gaps (matching the traveler's pace) instead of 5 min

```typescript
// Before:
const MIN_OVERLAP_GAP = 5;

// After:
const MIN_OVERLAP_GAP = scheduleConstraints?.bufferMinutesBetweenActivities || 15;
```

### Root Cause 2: Stage 4.6 skips activities without coordinates

Stage 4.6 does distance-aware buffer enforcement, but line 7166 has `if (!curCoords || !nextCoords) continue` — activities missing coordinates get no buffer enforcement at all.

**Fix (index.ts, Stage 4.6 ~line 7166):**
- When coordinates are missing, fall back to a minimum 15-minute buffer instead of skipping
- After the coordinate null check, add a no-coord path that enforces a floor buffer

```typescript
if (!curCoords?.lat || !curCoords?.lng || !nextCoords?.lat || !nextCoords?.lng) {
  // No coordinates — enforce a minimum buffer as fallback
  const FALLBACK_BUFFER = 15;
  const curEndMins = parseTimeToMinutes(current.endTime || current.startTime || '');
  const nextStartMins = parseTimeToMinutes(next.startTime || '');
  if (curEndMins !== null && nextStartMins !== null) {
    const gap = nextStartMins - curEndMins;
    if (gap < FALLBACK_BUFFER && gap >= 0) {
      const deficit = FALLBACK_BUFFER - gap;
      // cascade-shift subsequent activities
      for (let j = i + 1; j < day.activities.length; j++) {
        const s = parseTimeToMinutes(day.activities[j].startTime || '');
        const e = parseTimeToMinutes(day.activities[j].endTime || '');
        if (s !== null) day.activities[j].startTime = minutesToHHMM(s + deficit);
        if (e !== null) day.activities[j].endTime = minutesToHHMM(e + deficit);
      }
      bufferFixCount++;
    }
  }
  continue;
}
```

### Root Cause 3: Check-in time ignores hotel standard

The Day 1 prompt (line 1646) tells the AI to put hotel check-in first, but doesn't say *when*. For a 6:15 AM arrival, `calculateEarliestStart` computes ~8:30 AM (arrival + customs + transfer + settle). But the Four Seasons check-in is 3:00 PM — the generated 8:30 AM check-in is unrealistic without early check-in being noted.

**Fix A — Prompt update (index.ts, line 1646):**

Update the Day 1 arrival instruction to explicitly mention check-in timing:

```
Day 1 MUST begin with hotel arrival as the FIRST activity (category: accommodation).
Title it "Luggage Drop & Early Exploration" if arriving BEFORE the hotel check-in time
({checkInTime}), or "Hotel Check-in & Refresh" if arriving AT or AFTER check-in time.
If arriving early, note "Early check-in subject to availability" in the description.
The startTime for this activity should be: arrival time + customs/transfer buffer,
but label it as a luggage drop if that's before {checkInTime}.
```

**Fix B — Post-generation clamp (new, after Stage 2.7):**

Add a small validator that checks Day 1's first accommodation activity:

```typescript
// Stage 2.75: Check-in time consistency
const hotelCheckInTime = effectiveHotelData?.checkInTime || '15:00';
const checkInMins = parseTimeToMinutes(hotelCheckInTime);
if (checkInMins !== null && aiResult.days.length > 0) {
  const day1 = aiResult.days[0];
  const checkinAct = day1.activities?.find(a =>
    (a.category || '').toLowerCase() === 'accommodation' &&
    /(check.?in|luggage drop)/i.test(a.title || '')
  );
  if (checkinAct) {
    const actStart = parseTimeToMinutes(checkinAct.startTime || '');
    if (actStart !== null && actStart < checkInMins) {
      // Arriving before check-in — relabel as luggage drop
      if (!/(luggage|bag|drop)/i.test(checkinAct.title || '')) {
        checkinAct.title = checkinAct.title?.replace(/check.?in/i, 'Luggage Drop') || 'Luggage Drop & Early Check-in';
      }
      if (!checkinAct.description?.includes('early check-in')) {
        checkinAct.description = (checkinAct.description || '') +
          ` Early check-in subject to availability (standard check-in: ${hotelCheckInTime}).`;
      }
    }
  }
}
```

---

### Summary

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Stage 2.7: use `scheduleConstraints.bufferMinutesBetweenActivities` instead of hardcoded 5 |
| `supabase/functions/generate-itinerary/index.ts` | Stage 4.6: add fallback 15-min buffer when coordinates missing |
| `supabase/functions/generate-itinerary/index.ts` | Day 1 prompt: clarify check-in vs luggage drop based on hotel check-in time |
| `supabase/functions/generate-itinerary/index.ts` | New Stage 2.75: post-generation clamp relabels early arrivals as luggage drop |

### What This Fixes
- **Day 4 lunch/wellness overlap** — Stage 2.7 now enforces 20+ min gaps, pushing the wellness session after lunch ends
- **Day 1 Shibuya→Otemachi zero gap** — Stage 4.6 fallback (or Stage 2.7 with 20+ min) ensures transit time
- **Day 1 8:30 AM "check-in"** — Relabeled to "Luggage Drop" with note about standard 3 PM check-in
- **"X activities have no travel buffer" warnings** — Reduced dramatically since gaps are now 15-30+ minutes instead of 5

