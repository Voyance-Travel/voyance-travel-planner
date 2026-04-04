

## Fix: Calendar Date Picker "Funny" Behavior on Re-Pick

### Problem

When the user picks dates the first time, everything works. But when they re-open the calendar to change dates and pick a new start date that's **after** the current end date, the following race condition occurs:

1. User picks new start date → `setStartDate(newDate)`, `setEndDate(undefined)` (clears end because old end < new start), `setPicking('end')`
2. The `useEffect` on line 450 fires immediately because `startDate` exists and `endDate` is now `undefined` → auto-sets `endDate = startDate + 5`
3. The calendar now shows an auto-filled end date before the user gets to pick one — the popover may close or the range highlights jump unexpectedly

This makes the calendar feel "funny" — the end date auto-fills while the user is still trying to select it.

### Fix

**File: `src/pages/Start.tsx`**

**Change 1: Gate the auto-set effect so it doesn't fire while the popover is open**

Lift the `open` state out of `DateRangePicker` into `StepOneTripDetails` (or pass a ref), and skip the auto-set `useEffect` when the calendar popover is open:

Actually, simpler approach — the `DateRangePicker` is a child component with its own `open` state. The `useEffect` that auto-sets endDate lives in the parent (`StepOneTripDetails`). The cleanest fix:

Add a `skipAutoEndDate` ref in `StepOneTripDetails`. Set it to `true` whenever `setEndDate(undefined)` is called from within the date picker (i.e., when clearing end date due to a new start being after the old end). The `useEffect` checks this ref and skips auto-setting when it's true.

Concretely:

1. **Add a ref** in `StepOneTripDetails` (~line 443):
   ```typescript
   const skipAutoEndDateRef = useRef(false);
   ```

2. **Wrap `setEndDate`** passed to `DateRangePicker` to set the ref when clearing:
   ```typescript
   const handleSetEndDate = (d: Date | undefined) => {
     if (!d) skipAutoEndDateRef.current = true;
     setEndDate(d);
   };
   ```

3. **Guard the useEffect** (~line 450):
   ```typescript
   useEffect(() => {
     if (skipAutoEndDateRef.current) {
       skipAutoEndDateRef.current = false;
       return;
     }
     if (startDate && !endDate) {
       setEndDate(addDays(startDate, 5));
     }
   }, [startDate, endDate, setEndDate]);
   ```

4. **Pass `handleSetEndDate`** instead of `setEndDate` to `DateRangePicker`.

### Why This Works

- First time picking dates: ref is `false`, auto-set fires normally (start picked → end auto-set to +5 days)
- Re-picking dates: when user picks a new start that clears end, `handleSetEndDate(undefined)` sets ref to `true`. The effect skips. User gets to pick their own end date. On the next real `setEndDate(someDate)` call, the ref stays `false`.

### Files
- `src/pages/Start.tsx` — 4 small edits in `StepOneTripDetails`

