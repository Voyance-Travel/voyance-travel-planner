# Show conflict times in Trip Completion panel

## Problem
Conflict issues in `TripHealthPanel` say:
> Day 3: "Breakfast at X" overlaps with "Transfer to Y"

…but never show the actual clock times, so users can't tell *where* the overlap is or fix it manually.

## Fix
Update the conflict detection in `src/components/trip/TripHealthPanel.tsx` (around lines 82–105) to:

1. Preserve the original `startTime` / `endTime` strings alongside the parsed minute values when building the `timed` array.
2. Include both activities' time ranges in the issue `message`.
3. Add an `overlapMinutes` value computed from `timed[i].end - timed[i+1].start` and surface it for clarity.

### New message format
```
Day 3: "Breakfast at X" (08:30–10:00) overlaps with "Transfer to Y" (09:15–09:45) — 45 min conflict
```

### Technical details
- Extend the mapped object to `{ name, start, end, startStr, endStr }` using the raw `a.startTime` / `a.endTime` strings (already in `HH:MM` form for displayed activities).
- Build the message as a single template string; keep the existing `severity`, `fixLabel`, `fixAction`, `dayNumber` fields untouched so the Refresh Day / Fix Timing buttons keep working.
- No design-token changes; message renders inside the existing issue row styling.
- Keep the `break` after the first conflict per day (unchanged behavior).

## Out of scope
- Fixing the Refresh Day button itself.
- Reporting more than one conflict per day.
- Changes to `fixDayTiming` logic.

## Files touched
- `src/components/trip/TripHealthPanel.tsx` (conflict block only)
