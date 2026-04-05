

## Fix: Strip Midnight Hotel Phantoms in sanitizeGeneratedDay

### Problem
On hotel-change days, "Return to Hotel" entries at 12:00-12:30 AM appear at the start of Day 3. The `repairBookends` fix in `repair-day.ts` should catch these but depends on `isHotelChange` being set correctly and on category detection (`isAccom`). A simpler safety net is needed earlier in the pipeline.

### Changes

**File: `supabase/functions/generate-itinerary/sanitization.ts`** — inside `sanitizeGeneratedDay`, after the chronological re-sort (line ~334) and before `return day` (line 337):

Add two blocks:

**Block 1: Strip pre-dawn hotel phantoms**
```typescript
// Strip phantom midnight hotel entries at the start of the day
// These are spillover from the previous day's late activities
if (day.activities.length > 0) {
  const firstMorningIndex = day.activities.findIndex((a: any) => {
    const hour = parseInt((a.startTime || '06:00').split(':')[0], 10);
    return hour >= 5;
  });
  if (firstMorningIndex > 0) {
    const midnightActivities = day.activities.slice(0, firstMorningIndex);
    const allAreHotelEntries = midnightActivities.every((a: any) =>
      (a.category || '').toLowerCase() === 'accommodation' ||
      (a.category || '').toLowerCase() === 'stay' ||
      (a.type || '').toLowerCase() === 'stay' ||
      /\b(?:return|freshen|check.?in|retire|end.?of.?day|back to|settle|wind down)\b/i.test(a.title || '')
    );
    if (allAreHotelEntries) {
      console.log(`[sanitizeGeneratedDay] Stripped ${firstMorningIndex} pre-dawn hotel phantom(s) from day ${dayNumber}`);
      day.activities = day.activities.slice(firstMorningIndex);
    }
  }
}
```

**Block 2: Fix hotel name mismatches in "Return to" titles**
```typescript
// Fix hotel name mismatches in "Return to" entries
for (const act of day.activities) {
  if (/^Return to /i.test(act.title || '') && act.venue_name) {
    const titleHotel = (act.title || '').replace(/^Return to /i, '').trim();
    if (titleHotel !== act.venue_name && act.venue_name.length > 0) {
      act.title = 'Return to ' + act.venue_name;
      act.name = act.title;
    }
  }
}
```

### Why this works
- Runs in `sanitizeGeneratedDay` which executes on **every** code path (both `action-generate-trip-day.ts` and `action-generate-day.ts`)
- Doesn't depend on `isHotelChange` flag or category detection — uses simple time + keyword matching
- Belt-and-suspenders with the existing `repairBookends` fix

### Files
- `supabase/functions/generate-itinerary/sanitization.ts` — add ~25 lines before `return day` in `sanitizeGeneratedDay`

