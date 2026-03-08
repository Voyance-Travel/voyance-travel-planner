

## Fix: Time Overlap Detection for All-Day/Long Events

### Problem

When a user specifies an all-day event (e.g., "US Open all day" → 11:00-19:00), the prompt tells the AI to dedicate the day to it, but there's no **post-generation enforcement**. The AI correctly generates the 11:00-19:00 event but also generates sightseeing/activities during those same hours. Nothing strips them out.

The overlap filtering code (lines ~11066-11094 in `index.ts`) only runs for **locked activities during regeneration**, not for must-do events during initial generation.

### Root Cause

Two gaps:
1. **Prompt gap**: The all-day event prompt (must-do-priorities.ts line 570-577) says "Do NOT schedule other major sightseeing on this day" but doesn't explicitly state the **blocked time range** (e.g., "11:00-19:00 is BLOCKED — zero activities may overlap this window"). The AI interprets "dedicate the day" loosely.
2. **No post-generation overlap filter**: After the AI returns activities, there's no code that detects "this day has a must-do from 11:00-19:00, remove any other non-structural activity that overlaps that window."

### Fix — Two layers

**1. Stronger prompt constraint in `must-do-priorities.ts` (buildMustDoPrompt)**

For all-day and half-day events, add explicit time-block language:

```
**US Open** → Day 3 at USTA Billie Jean King National Tennis Center
⏰ BLOCKED TIME: 11:00–19:00 (8 hours)
This time window is FULLY OCCUPIED. Do NOT schedule ANY activities between 11:00 and 19:00.
Only plan: breakfast before 10:30, transit to venue ~10:30, transit from venue ~19:00, dinner after 19:30.
```

Changes in `must-do-priorities.ts`:
- In `buildMustDoPrompt`, for all-day events, compute and state explicit blocked start/end times using `getTimeForPreference` + `estimatedDuration`
- Add a hard constraint line: `⏰ BLOCKED TIME: {start}–{end}. NO activities may be scheduled in this window.`
- For half-day events, similarly state the blocked window

**2. Post-generation overlap stripping in `index.ts`**

After activities are normalized (around line ~11095, after the locked-activities merge), add a new step that:
- Checks if the current day has any must-do events (all_day_event or half_day_event) from the `scheduledMustDos`
- For each event, computes the blocked time range
- Filters out any non-event, non-meal-adjacent activity whose time overlaps the blocked range
- Keeps: the event itself, transit to/from event, breakfast before, dinner after

This reuses the same overlap logic already used for locked activities (lines 11072-11082).

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/must-do-priorities.ts` | In `buildMustDoPrompt`: add explicit blocked time windows for all-day and half-day events. Add `getBlockedTimeRange()` helper. |
| `supabase/functions/generate-itinerary/index.ts` | After normalization (~line 11095): add overlap stripping against must-do event time blocks. Pass `scheduledMustDos` data into the per-day generation context so it's available for filtering. |

### What stays the same
- Must-do parsing, scheduling, and priority logic unchanged
- Pre-booked commitments flow unchanged (already has proper time blocking)
- Locked activity overlap filtering unchanged
- All frontend components unchanged

