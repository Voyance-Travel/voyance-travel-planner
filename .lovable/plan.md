

## Add Departure-Day Activity Stripping in the Orchestrator

### Context

The departure-day 3-hour buffer filter already exists in `action-generate-day.ts` (lines 567-589) and `repair-day.ts` handles logistics sequencing. However, as a safety net — matching the pattern requested for arrival-day — we need an explicit post-processing filter in the orchestrator (`action-generate-trip-day.ts`) that strips activities scheduled after `departureTime - 3h`.

### The Fix

**File: `action-generate-trip-day.ts` — after the validate/repair pipeline (~line 950), before cross-day dedup (~line 952)**

Insert a departure-day filter block:

```typescript
// DEPARTURE-DAY SAFETY NET: strip activities after departure - 3h buffer
if (isLastDay && depTime24 && dayResult?.activities?.length > 0) {
  const departureMins = parseTimeToMinutes(depTime24) || 0;
  const latestAllowed = departureMins - 180; // 3 hours before departure
  if (latestAllowed > 0) {
    const before = dayResult.activities.length;
    dayResult.activities = dayResult.activities.filter((activity: any) => {
      const cat = ((activity.category || '') as string).toUpperCase();
      const title = ((activity.title || '') as string).toLowerCase();
      if (cat === 'TRANSPORT' || cat === 'FLIGHT' || /departure|heading home/i.test(title)) return true;
      if (cat === 'STAY' && /check.?out/i.test(title)) return true;

      const startMinutes = parseTimeToMinutes(activity.startTime || activity.start_time || '');
      if (startMinutes > 0 && startMinutes > latestAllowed) {
        console.warn(`[DEPARTURE-FIX] Removed "${activity.title}" at ${activity.startTime || activity.start_time} — after departure - 3h buffer`);
        return false;
      }
      return true;
    });
    if (dayResult.activities.length < before) {
      console.log(`[generate-trip-day] Departure safety net removed ${before - dayResult.activities.length} activities`);
    }
  }
}
```

This mirrors the arrival-day filter and ensures any activities that slip through the per-day generator or repair pipeline are caught before cross-day dedup and persistence.

### Files to Edit

| File | Change |
|------|--------|
| `action-generate-trip-day.ts` | Insert departure-day stripping filter at ~line 950, after repair pipeline, before cross-day dedup |

### What We're NOT Changing
- `action-generate-day.ts` — already has this filter (lines 567-589)
- `repair-day.ts` — already handles departure logistics sequencing
- `validate-day.ts` — already checks logistics sequence

