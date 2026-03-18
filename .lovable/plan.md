

## Fix: Stale `duration` Display String After Cascade Shift

### Root Cause

Activities have **two separate duration representations**:
1. `endTime` — the actual end time string (e.g. "16:45")  
2. `duration` — a **pre-formatted display string** (e.g. "1h 30m") set at generation time and never recalculated

When cascade shift runs (lines 4356-4367), it correctly shifts both `startTime` and `endTime` by the same delta, but **never touches `duration`**. The UI (line 9704) then shows the stale `duration` string alongside the shifted times.

The "3:15 PM → 3:15 PM" case likely happened when the end-before-start clamp (line 4362) triggered but set `fixedEnd` to the same value as `newStart` due to a zero or negative `origDuration` calculation (when `aEnd` was null/missing).

### Fix — 1 file: `EditorialItinerary.tsx`

**Change 1: Recalculate `duration` + `durationMinutes` in cascade shift** (line ~4360-4367)

After computing `newStart` and `newEnd` for cascaded activities, recompute `durationMinutes` and the `duration` display string from the new times:

```typescript
const newDurMins = parseTime(newEnd) - parseTime(newStart);
const durStr = newDurMins >= 60 
  ? `${Math.floor(newDurMins/60)}h${newDurMins%60 ? ` ${newDurMins%60}m` : ''}`
  : `${newDurMins} min`;
return { ...activity, startTime: newStart, endTime: newEnd, time: newStart,
         durationMinutes: newDurMins, duration: durStr };
```

Apply this in both the normal cascade path and the clamp path.

**Change 2: Fix clamp edge case** (line 4363)

The `origDuration` calculation `parseTime(aEnd) - parseTime(aStart)` can return 0 or negative if `aEnd`/`aStart` are already invalid. Add a floor:

```typescript
const origDuration = aEnd && aStart 
  ? Math.max(parseTime(aEnd) - parseTime(aStart), 15) 
  : 30;
```

