

## Fix: Make Parsed Dates Editable in "Build Myself" Review Step

### Problem

When the AI parses pasted trip research, it sometimes gets dates wrong (truncation, wrong month, etc.). The review screen in `ManualTripPasteEntry` shows day count and activities but **never displays the parsed start/end dates** — so users can't see or fix them before the trip is created.

### The Fix

**Add an editable date display to the review step in `ManualTripPasteEntry.tsx`.**

1. **Add local state** for editable dates initialized from `parsed.dates`:
   ```
   const [editedStartDate, setEditedStartDate] = useState(parsed?.dates?.start || '');
   const [editedEndDate, setEditedEndDate] = useState(parsed?.dates?.end || '');
   ```

2. **Show dates in the review summary card** (between the destination header and day preview). Display as two inline date inputs (or calendar popovers matching `TripSetup` style) with the parsed values pre-filled. If no dates were detected, show a prompt: "No dates detected — add them now or edit later."

3. **Pass edited dates back into `parsed` before calling `createTripFromParsed`** in `handleConfirm`:
   ```
   const finalParsed = { ...parsed };
   if (editedStartDate || editedEndDate) {
     finalParsed.dates = {
       start: editedStartDate || parsed.dates?.start || '',
       end: editedEndDate || parsed.dates?.end || '',
     };
   }
   const result = await createTripFromParsed(finalParsed, user.id);
   ```

4. **Also recalculate `duration`** when dates change so `createTripFromParsed` computes the correct `endDate` from `startDate + numDays`.

### UI Design

Inside the review card, below the destination title:

```text
┌──────────────────────────────────────┐
│ Trip to Barcelona                    │
│ 5 days · 18 activities               │
│                                      │
│ 📅 Jun 10, 2026 → Jun 14, 2026  ✏️  │
│    (click dates to edit)             │
│                                      │
│ Day 1  Arrival & Gothic Quarter      │
│ Day 2  Sagrada Familia & Park Güell  │
│ ...                                  │
└──────────────────────────────────────┘
```

Use simple `<input type="date">` fields styled to match the card — lightweight, no calendar popover needed for this context. If dates look wrong, users fix them inline; if correct, they proceed as before.

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/planner/ManualTripPasteEntry.tsx` | Add date state, date display/edit UI in review step, pass edited dates to `createTripFromParsed` |

Single file, ~30 lines added.

