

## Fix: Validate End Time Before Start Time

### Problem
Two entry points allow saving activities with end time before start time:
1. **Time Edit Modal** (`EditTimeDialog`, line ~10402): No validation before calling `onSave`
2. **Cascade shift** (`handleApplyRefreshChanges`, line 1952): Patches from refresh-day can produce invalid times with no check
3. **`handleUpdateActivityTime`** (line 4312): Accepts any start/end pair, even calculates negative `durationMinutes` via `Math.max(newDuration, 0)` — masking the problem

### Fix

A single validation utility + guards at all 3 entry points:

| # | File | Change |
|---|------|--------|
| 1 | `EditorialItinerary.tsx` (line ~10402) | In `EditTimeDialog`, disable the Save button and show inline error when `endTime <= startTime` |
| 2 | `EditorialItinerary.tsx` (line ~4312) | In `handleUpdateActivityTime`, add early return with toast error if `endTime <= startTime` |
| 3 | `EditorialItinerary.tsx` (line ~1952) | In `handleApplyRefreshChanges`, after patching, validate each activity and auto-fix any where end < start by adding the original duration to the new start time |
| 4 | `EditorialItinerary.tsx` (line ~4340) | In cascade shift logic, after computing `newEnd` for each shifted activity, clamp so `newEnd >= newStart` (add minimum 15min if they'd cross) |

### Implementation details

**EditTimeDialog** (UI validation):
```typescript
const isInvalid = endTime <= startTime;
// Show red text: "End time must be after start time"
// Disable Save button when isInvalid
```

**handleUpdateActivityTime** (programmatic guard):
```typescript
if (parseTime(endTime) <= parseTime(startTime)) {
  toast.error('End time must be after start time');
  return day; // no-op
}
```

**handleApplyRefreshChanges** (auto-fix patches):
After patching start/end from refresh-day, if `endTime <= startTime`, set `endTime = startTime + originalDuration` (or +30min fallback).

**Cascade shift clamp**:
After computing `newStart` and `newEnd` for shifted activities, if `newEnd <= newStart`, set `newEnd = newStart + originalDuration`.

