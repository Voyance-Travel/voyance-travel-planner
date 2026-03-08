

## Problem

The import parser has two bugs causing activities to land at absurd times (12 AM, 1:30 AM):

**Bug 1 — Numbered lists eaten as times.** `TIME_PATTERN` is `/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi` — every part is optional, so it matches bare numbers like "1", "2", "12" from numbered lists ("1. Visit museum"). `normalizeTime` then converts "1" → "01:00" (1 AM), "12" → "12:00" (which could be correct or wrong depending on context). This is the primary source of the midnight/1 AM times.

**Bug 2 — No smart default times.** When no time is detected, activities get `undefined` startTime → empty string on import → they sort to the bottom with no time. There's no logic to assign reasonable daytime slots (9 AM, 10:30 AM, 12 PM, etc.) based on position in the day.

**UX Gap — No way to fix times before importing.** The assign step shows times read-only. Users can't adjust times before committing the import, forcing cleanup after the fact.

## Plan

### Fix 1: Tighten `TIME_PATTERN` to stop matching bare numbers
**File:** `src/components/itinerary/ImportActivitiesModal.tsx` (line 74)

Change the regex to require at least one of: `:MM`, `am/pm`, or both. Bare digits alone won't match.

```typescript
// Requires either :MM portion, or am/pm, or both — never just a bare number
const TIME_PATTERN = /(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))/gi;
```

This means:
- `9:00 AM` ✅, `14:30` ✅, `9am` ✅, `9 PM` ✅
- `1` ❌, `12` ❌, `2.` ❌ (no longer match)

### Fix 2: Smart default time assignment for activities without times
**File:** `src/components/itinerary/ImportActivitiesModal.tsx` (after parsing loop, ~line 320)

After all activities in a group are parsed, run a post-processing pass that assigns sequential daytime slots to any activity with no `startTime`:

- Start from `09:00` (or after the last timed activity)
- Space activities 90 minutes apart
- Cap at `21:00`
- Mark these as "estimated" so the UI can show them differently

```typescript
// Post-process: assign sequential default times to untimed activities
for (const group of groups) {
  let nextDefault = 9 * 60; // 9:00 AM in minutes
  for (const activity of group.activities) {
    if (activity.startTime) {
      // Advance the default clock past this timed activity
      const mins = timeToMinutes(activity.startTime);
      nextDefault = Math.max(nextDefault, mins + 90);
    } else {
      // Assign a reasonable daytime slot
      activity.startTime = minutesToTime(Math.min(nextDefault, 21 * 60));
      activity.isEstimatedTime = true;
      nextDefault += 90;
    }
  }
}
```

Add `isEstimatedTime?: boolean` to the `ParsedActivity` interface.

### Fix 3: Allow inline time editing in the assign/review step
**File:** `src/components/itinerary/ImportActivitiesModal.tsx` (activity preview, ~line 569-590)

Make the time display clickable/editable so users can adjust times before importing:

- Show estimated times in a muted/italic style with a small clock icon
- Clicking a time opens a small inline time input (or uses an `<input type="time">`)
- Add an `updateActivityTime` callback to modify the time in state

This way users can fix any bad parses or adjust estimated times before they commit the import.

### Files Modified

| File | Changes |
|------|---------|
| `src/components/itinerary/ImportActivitiesModal.tsx` | Tighten TIME_PATTERN regex, add post-parse default time assignment, add inline time editing in assign step |

No backend changes needed. No other files affected.

