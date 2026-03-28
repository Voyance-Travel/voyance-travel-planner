

## Time Ordering Validation (Post-Processing)

### Problem
Activities go backwards in time — e.g. dinner ends at 8:45 PM, then "Nightcap" shows 12:30 PM, then "Return to hotel" at 2:05 PM. The AI confuses AM/PM for late-night activities.

### Changes

**1. `supabase/functions/generate-itinerary/day-validation.ts` — Add `enforceChronologicalOrder`**

Add three functions at the end of the file:

- `parseTimeToMinutesLocal(timeStr)` — parses "10:00 AM", "22:00", etc. to minutes since midnight. This is local to day-validation.ts (the shared util in `src/` can't be imported from edge functions).
- `minutesToTimeString(totalMinutes)` — converts minutes back to "h:MM AM/PM" format.
- `enforceChronologicalOrder(day)` — walks activities sequentially:
  - If `currStart < prevEnd` and gap > 240 min, try AM/PM flip (+12 hours)
  - Otherwise push activity to start 15 min after previous ends, preserving duration
  - Export it for use in index.ts

**2. `supabase/functions/generate-itinerary/index.ts` — Call at both parse sites**

At both locations (after hotel enforcement, ~line 2454 and ~line 10375), add:

```typescript
generatedDay = enforceChronologicalOrder(generatedDay);
```

Import it alongside existing day-validation imports (~line 1548).

**3. Redeploy** the `generate-itinerary` edge function.

### Technical notes
- The existing `src/utils/timeFormat.ts` has `parseTimeToMinutes` and `normalizeTimeTo24h`, but edge functions can't import from `src/`. The day-validation.ts file will have its own lightweight time parser.
- Both 12h ("2:30 PM") and 24h ("14:30") formats are handled.
- The fix preserves activity duration when shifting times forward.

