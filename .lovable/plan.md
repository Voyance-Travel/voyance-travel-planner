

## Fix: Hotel Check-in Defaults to 11 PM Instead of 3 PM

### Root Cause

In `src/utils/injectHotelActivities.ts`, the `buildCheckInActivity` function (lines 33-81) has logic that pushes the check-in time **later** if existing activities end after the default 3 PM:

```typescript
// If the latest activity ends AFTER the default check-in time,
// push check-in to 30 min after
if (latestEnd > checkInMinutes) {
  checkInTime = latestEnd + 30 min; // e.g. 23:00 if last activity ends at 22:30
}
```

So when a hotel is added to an already-generated itinerary that has evening activities, the check-in gets pushed to 11 PM. This is backwards — check-in should stay at 3 PM and the **activities** should adjust around it.

### Fix Plan

**File: `src/utils/injectHotelActivities.ts`**

1. **Remove the "push check-in later" logic** from `buildCheckInActivity` — always use the hotel's check-in time (default 15:00). The function should be simple: just build the activity at the specified time.

2. **Add a new `adjustActivitiesAroundCheckIn` function** that runs after check-in is injected:
   - Find activities that **overlap** with the check-in window (check-in time → check-in time + 30 min)
   - Shift those overlapping activities to start after check-in ends (e.g., 15:30)
   - Cascade: if shifting one activity causes it to overlap with the next, shift that one too
   - Only shift activities that start **at or after** the check-in time — morning activities (before 3 PM) stay untouched
   - Cap the cascade: don't push anything past 23:00 (drop or compress if needed)

3. **Apply the adjustment** in both `injectHotelActivitiesIntoDays` and `injectMultiHotelActivities` after inserting the check-in activity.

### Behavior After Fix

| Before | After |
|--------|-------|
| Activities at 3 PM, 5 PM, 7 PM → Check-in pushed to 11 PM | Check-in at 3 PM → Activities shift to 3:30 PM, 5:30 PM, 7:30 PM |
| Morning activities unaffected | Morning activities still unaffected |
| No time adjustment cascade | Clean cascade with gap preservation |

### Files to Modify

| File | Change |
|------|--------|
| `src/utils/injectHotelActivities.ts` | Remove late-push logic from `buildCheckInActivity`, add `adjustActivitiesAroundCheckIn`, apply in both injection functions |

