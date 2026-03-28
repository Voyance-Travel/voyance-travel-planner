

## Fix: Return to Hotel Duration Calculation Bug

### Problem

"Return to Hotel" cards show 8-hour durations because the AI sets `endTime` to the next morning (e.g., 6:30 AM) or 11:59 PM, treating the entire overnight sleep as activity duration. A "Return to Hotel" at 10:25 PM should be a ~15-minute card (arrive, settle in), not an 8-hour event.

### Root Cause

Two issues compound:

1. **AI-generated cards** — The AI sometimes sets `endTime` to the next morning or 11:59 PM for "Return to Hotel" activities, treating overnight sleep as duration. The `duration` string comes directly from AI output (e.g., "8h 00m").

2. **Backend normalization** — `calculateDuration(startTime, endTime)` at line 2458 in `index.ts` blindly subtracts, producing large `durationMinutes` values. No special handling for end-of-day accommodation.

3. **Front-end partial fix** — Line 10340-10342 in `EditorialItinerary.tsx` already shows "Overnight" when `durationMinutes > 180` for accommodation, but this still shows a misleading label for what should be a brief activity.

### Fix — Two changes

**Change 1: Backend — Clamp end-of-day accommodation cards (`index.ts`, after line ~2476)**

After the logistics auto-fix block, add a pass that detects "Return to Hotel" / "Freshen up" / end-of-day accommodation cards and clamps their duration:

```typescript
// Clamp end-of-day accommodation cards to realistic duration
const accomTitle = (normalizedAct.title || '').toLowerCase();
const isReturnToHotel = normalizedAct.category?.toLowerCase() === 'accommodation' &&
  (accomTitle.includes('return to') || accomTitle.includes('freshen up') || 
   accomTitle.includes('rest at') || accomTitle.includes('back to'));

if (isReturnToHotel && normalizedAct.durationMinutes > 60) {
  // "Return to hotel" is a 15-min activity, not an overnight stay
  const clampedDuration = 15;
  normalizedAct.durationMinutes = clampedDuration;
  if (normalizedAct.startTime) {
    const startMins = timeToMinutes(normalizedAct.startTime);
    normalizedAct.endTime = minutesToHHMM(startMins + clampedDuration);
  }
  normalizedAct.duration = '15 min';
  console.log(`[Duration fix] Clamped "${normalizedAct.title}" from ${act.durationMinutes || '?'}min to ${clampedDuration}min`);
}
```

Also apply the same logic in the **bookend validator** — its "Return to" cards already use `dur=15` so they're fine, but AI-generated ones that survive alongside should also be clamped.

**Change 2: Front-end — Better fallback for accommodation cards (`EditorialItinerary.tsx`, line ~10338-10343)**

Update the display logic so accommodation cards with unreasonable durations show the clamped value, not "Overnight":

```typescript
// Replace the current accommodation duration display logic
{(activityType === 'accommodation' || titleLower.includes('return to') || titleLower.includes('freshen up'))
  ? (activity.durationMinutes && activity.durationMinutes > 180
    ? (titleLower.includes('check-in') || titleLower.includes('checkout') 
       ? activity.duration 
       : null)  // Hide duration entirely for return-to-hotel cards with bad data
    : activity.duration)
  : activity.duration}
```

This hides the duration line entirely for "Return to Hotel" cards with obviously wrong durations (>3 hours), rather than showing "Overnight" or "8h 00m".

### Result

| Before | After |
|--------|-------|
| Day 2: Return to Hotel 10:25 PM → 11:59 PM, "8h 00m" | 10:25 PM → 10:40 PM, "15 min" |
| Day 4: Return to Hotel 10:30 PM → 6:30 AM, "8:00" | 10:30 PM → 10:45 PM, "15 min" |
| Front-end shows "Overnight" for >3h accommodation | Duration hidden or shows correct 15 min |

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Clamp Return to Hotel / Freshen up durationMinutes to 15min, fix endTime |
| `src/components/itinerary/EditorialItinerary.tsx` | Hide duration display for accommodation cards with unreasonable duration values |

