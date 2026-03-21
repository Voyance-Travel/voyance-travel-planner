

## Fix: Calendar shows "4 days" for a 5-day trip

### Problem
`TripDateEditor.tsx` uses `differenceInDays(end, start)` which returns intervals (nights), not inclusive calendar days. Jul 1–5 = 4 intervals, but 5 calendar days.

### Root cause
- Line 113: `currentDays = differenceInDays(currentEnd, currentStart)` → 4 for Jul 1–5
- Line 290: `newDayCount = differenceInDays(pendingEnd, pendingStart)` → same
- Line 333: displays `{newDayCount} days` — shows "4 days"

The interval-based count is also used for delta math (`daysAdded = newDays - currentDays`), which is correct as-is because both sides use the same base. So the delta doesn't need changing — only the display.

### Fix

**File: `src/components/trip/TripDateEditor.tsx`**

1. **Line 333**: Change display from `{newDayCount}` to `{newDayCount + 1}` to show inclusive day count
2. That's it. The delta (`dayDelta`) remains correct because it's a difference of two interval counts, and +1 would cancel out.

Also fix line 395 (`After Day ${currentDays}`) → `After Day ${currentDays + 1}` if it's meant to show the last day number, and line 571 similarly.

Single display-only fix — no logic changes to the date change result calculations.

