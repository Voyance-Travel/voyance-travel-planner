

## Fix: Midnight Truncation Warning Not Firing for Non-Overlapping Activities

### Root Cause

In `cascadeFixOverlaps()` (line 114-134 of `injectHotelActivities.ts`), the `__truncatedAtMidnight` flag is only set inside the `if (currStart < prevEnd)` block — i.e., only when an activity overlaps with the previous one and needs to be shifted forward.

But the last surviving activity (e.g., "Lunch at L'Estaminet" at 11:30 PM) may not overlap its predecessor at all. Its end time (11:30 PM + 90 min = 1:00 AM) gets silently clamped to 23:59 by `minutesToTime`, but since there was no overlap, the truncation flag is never set. The dialog and toast logic both check for `__truncatedAtMidnight` and find nothing.

### Fix — 1 file

**`src/utils/injectHotelActivities.ts`** — Add a second pass after the overlap-fixing loop that checks ALL activities for midnight clamping, regardless of whether they were shifted by an overlap:

```typescript
// After the overlap-fixing loop (line 135), before the filter:

// Second pass: flag ANY activity whose end time is clamped by MAX_TIME
for (let i = 0; i < result.length; i++) {
  const act = result[i];
  if ((act as any).__truncatedAtMidnight) continue; // already flagged
  const start = timeToMinutes(act.startTime);
  const origDuration = act.durationMinutes || 30;
  if (start + origDuration > MAX_TIME) {
    const actualDuration = MAX_TIME - start;
    if (actualDuration < origDuration) {
      const durationStr = actualDuration >= 60
        ? `${Math.floor(actualDuration / 60)} hr${actualDuration % 60 ? ` ${actualDuration % 60} min` : ''}`
        : `${actualDuration} min`;
      result[i] = {
        ...result[i],
        endTime: minutesToTime(MAX_TIME),
        durationMinutes: actualDuration,
        duration: durationStr,
        __truncatedAtMidnight: true,
        __originalDurationMinutes: origDuration,
      } as any;
    }
  }
}
```

This ensures that "Lunch at L'Estaminet" (11:30 PM, 90 min → clamped to 29 min) gets flagged, which then:
- Shows the amber warning in the confirmation dialog ("will be shortened to fit before midnight")
- Fires the toast after confirming ("shortened to 29 min, was 90 min")
- Drops the activity entirely if it loses >50% of duration (29 min < 45 min = 50% of 90 → it would be dropped instead of silently truncated)

### Result
- Activities clamped at midnight are always detected, whether caused by overlap-shifting or by natural positioning
- The existing dialog warning section and toast notifications work correctly once the flag is set
- The >50% drop threshold means a 90-min activity truncated to 29 min will be dropped entirely and listed in the "removed" section, which is the correct UX

