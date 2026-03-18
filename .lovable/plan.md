

## Fix: Drop Overflow Activities After Cascade Shift

### Problem

When a cascade time shift pushes activities past 23:59, the `formatTime` clamper (line 4389) forces both `startTime` and `endTime` to 23:59, producing zero-duration "ghost" activities like "11:59 PM → 11:59 PM, 0 min". `cascadeFixOverlaps` (line 103 in `injectHotelActivities.ts`) only fixes `startTime` and never updates `endTime`, so it cannot detect or remove these broken activities.

### Root Causes

1. **`cascadeFixOverlaps`** only shifts `startTime` forward — never recalculates `endTime`. Activities clamped at 23:00+ keep their original (also-clamped) endTime, resulting in zero or near-zero durations.
2. **Time edit cascade** (line 4397-4426) uses `formatTime` which clamps at `23*60+59`. When both start and end clamp to 23:59, duration becomes 0.
3. No post-cascade filter removes activities that no longer fit in the day.

### Fix — 2 files

**1. `src/utils/injectHotelActivities.ts` — Update `cascadeFixOverlaps`**

After shifting startTime, also recalculate endTime to preserve the activity's original duration. Then filter out activities that no longer fit (startTime >= 23:00, or remaining duration < 15 minutes after clamping). Return only valid activities.

```text
cascadeFixOverlaps(activities)
  ├─ for each activity after first:
  │    shift startTime if overlapping previous
  │    recalculate endTime = startTime + durationMinutes
  │    clamp endTime to MAX_TIME (23:59)
  ├─ filter out activities where:
  │    startTime >= 23:00 AND it's not a structural tag (checkout, departure)
  │    OR endTime - startTime < 15 minutes (too short to be meaningful)
  └─ return filtered array
```

Key changes:
- Use `durationMinutes || 30` to compute expected endTime after shift
- Clamp endTime to `23:59` but then check if resulting duration < 15 min
- Filter out non-structural activities that don't fit
- Update `duration` string field to stay in sync with new times

**2. `src/components/itinerary/EditorialItinerary.tsx` — Surface overflow notification**

In the two main callers of `cascadeFixOverlaps`:

- **`handleAddActivity`** (line 4289): Compare activity count before/after cascade. If activities were dropped, show a toast: "X activities removed — they no longer fit in this day's schedule."
- **Time edit with cascade** (line 4432): Same pattern — compare count before/after, toast if dropped.

No changes needed in `flightItineraryPatch.ts` or `InlineModifier.tsx` since those are backend-driven and already have their own error handling.

### Result

Activities pushed past the end of the day are cleanly removed instead of showing confusing "11:59 PM → 11:59 PM, 0 min" entries. A toast informs the user how many activities were dropped so they can re-schedule if needed.

