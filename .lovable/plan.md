

## Fix: Cascade Shift Silently Destroys Original Duration Before Truncation Check

### Root Cause

In `handleUpdateActivityTime` (line 4502-4530), when cascade-shifting activities:

1. `formatTime()` (line 4497) clamps any time to `23:59`
2. `newEnd = formatTime(parseTime(aEnd) + deltaMinutes)` silently clamps the end time
3. `recalcDuration(newStart, newEnd)` then computes `durationMinutes` from the clamped times → **29 min** instead of the original **90 min**
4. When `cascadeFixOverlaps` runs, it sees `durationMinutes: 29` and `start + 29 = 1439 ≤ 1439` → no truncation detected
5. The `__truncatedAtMidnight` flag is never set, so no warning appears

The second pass we added to `cascadeFixOverlaps` is correct — it just never fires because the original duration is already destroyed upstream.

### Fix — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`** — In the cascade branch of `handleUpdateActivityTime` (lines 4507-4528), detect when `formatTime` clamps the end time and preserve the original duration:

```typescript
// Around line 4507-4528 — cascade shift for activities after the edited one
if (cascade && aIdx > activityIndex && deltaMinutes !== 0) {
  const aStart = activity.startTime || activity.time;
  const aEnd = activity.endTime;
  const rawNewStart = aStart ? parseTime(aStart) + deltaMinutes : null;
  const rawNewEnd = aEnd ? parseTime(aEnd) + deltaMinutes : null;
  const newStart = rawNewStart !== null ? formatTime(rawNewStart) : aStart;
  const newEnd = rawNewEnd !== null ? formatTime(rawNewEnd) : aEnd;

  // Detect if end time was clamped by formatTime (original exceeded 23:59)
  const MAX_MINS = 23 * 60 + 59;
  const wasClamped = rawNewEnd !== null && rawNewEnd > MAX_MINS;
  const origDuration = aEnd && aStart
    ? Math.max(parseTime(aEnd) - parseTime(aStart), 15)
    : (activity.durationMinutes || 30);

  // ... existing endTime<=startTime guard and normal update ...

  // When building the returned activity, if wasClamped, attach truncation metadata
  // so cascadeFixOverlaps and the UI warning logic can detect it
  if (wasClamped && newStart) {
    const actualDuration = parseTime(newEnd) - parseTime(newStart);
    return {
      ...activity,
      startTime: newStart, endTime: newEnd, time: newStart,
      durationMinutes: actualDuration,
      __truncatedAtMidnight: true,
      __originalDurationMinutes: origDuration,
    };
  }
  // ... normal non-clamped return ...
}
```

This ensures:
- Lunch at 11:30 PM with original 90 min → clamped to 23:59 → `__truncatedAtMidnight: true`, `__originalDurationMinutes: 90`
- The 50% drop rule fires: 29 < 45 (50% of 90) → Lunch is **dropped** and listed in the overflow dialog
- If not dropped (e.g. activity only loses 20%), the amber warning toast fires correctly

### Technical Details

- `formatTime` at line 4497 does `Math.min(mins, 23*60+59)` — this is the silent clamp
- `rawNewEnd` captures the unclamped value to detect overflow
- The `__truncatedAtMidnight` flag flows through to `previewCascadeOverflow` → cascade dialog → toast warnings
- No changes needed to `cascadeFixOverlaps` — the second pass there handles cases where activities enter without pre-clamped times (e.g. hotel injection paths)

