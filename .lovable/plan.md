

## Fix: Silent End-Time Clamping at Midnight Boundary

### Root Cause

In `src/utils/injectHotelActivities.ts`, `cascadeFixOverlaps()` (line 103-145):

```typescript
const newEnd = Math.min(newStart + origDuration, MAX_TIME); // 23:59
const actualDuration = newEnd - newStart;
```

When an activity's computed end time exceeds 23:59, the end time is silently clamped and `durationMinutes` is reduced. The filter at line 132-144 only drops activities with < 15 min remaining AND starting after 22:00, so a 90-min lunch clamped to 29 min at 11:30 PM survives without any user notification.

The `minutesToTime` helper (line 10558 in EditorialItinerary.tsx) also silently clamps: `Math.min(mins, 23 * 60 + 59)`.

### Plan — 2 files

**1. `src/utils/injectHotelActivities.ts` — `cascadeFixOverlaps()`**

Add a `truncated` flag to activities whose duration was reduced by midnight clamping. This lets the UI detect and warn:

- When `newEnd` would exceed `MAX_TIME` and the resulting `actualDuration` is significantly shorter than `origDuration` (loses > 25% of original duration), mark the activity with `__truncatedAtMidnight: true` and `__originalDurationMinutes: origDuration`.
- Also increase the drop threshold: if an activity loses more than 50% of its original duration due to clamping, include it in the dropped list instead of keeping a uselessly short version.

**2. `src/components/itinerary/EditorialItinerary.tsx` — Cascade confirmation dialog**

- In the "Shift anyway" confirmation dialog (line 6747-6796), after applying `kept` activities, check for any activities with `__truncatedAtMidnight` flag.
- Show an additional toast warning: "'{title}' was shortened to {actualDuration} min (originally {originalDuration} min) to fit before midnight."
- Also show truncated activities in the confirmation dialog itself, in a separate section below the dropped list: "These activities will be shortened to fit before midnight."

### Technical Details

```typescript
// injectHotelActivities.ts — cascadeFixOverlaps
const newEnd = Math.min(newStart + origDuration, MAX_TIME);
const actualDuration = newEnd - newStart;
const wasTruncated = (newStart + origDuration) > MAX_TIME;

// If loses > 50% of duration, treat as dropped
if (wasTruncated && actualDuration < origDuration * 0.5) {
  // Will be filtered out below
}

result[i] = {
  ...result[i],
  startTime: minutesToTime(newStart),
  endTime: minutesToTime(newEnd),
  durationMinutes: actualDuration,
  duration: durationStr,
  ...(wasTruncated && actualDuration < origDuration ? {
    __truncatedAtMidnight: true,
    __originalDurationMinutes: origDuration,
  } : {}),
};
```

```typescript
// EditorialItinerary.tsx — confirmation dialog
// After applying kept:
const truncated = kept.filter((a: any) => a.__truncatedAtMidnight);
if (truncated.length > 0) {
  truncated.forEach((a: any) => {
    toast.warning(`"${a.title}" shortened to ${a.durationMinutes} min (was ${a.__originalDurationMinutes} min) to fit before midnight`);
  });
}
```

In the dialog body, add a warning section for truncated activities so users see the impact before confirming.

### Result
- Activities truncated by midnight clamping show a visible warning toast after confirmation
- The confirmation dialog lists both dropped AND truncated activities so users can make an informed decision
- Activities losing > 50% of their duration are dropped entirely instead of kept in a uselessly short form

