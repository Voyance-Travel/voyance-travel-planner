

## Add Completion Indicator to Day Navigation Pills

### What changes
In the day picker buttons (lines 4354-4464 of `EditorialItinerary.tsx`), add a visual indicator when all activities in a day are locked by the user (meaning the day is "set"/"planned").

### File: `src/components/itinerary/EditorialItinerary.tsx`

**1. Compute "day complete" status** (inside the `days.map` loop, around line 4357):

Add a check: a day is "complete" when it has real activities AND all of them are locked (`isLocked: true`):
```ts
const allActivitiesLocked = dayHasRealActivities && 
  (day.activities || [])
    .filter((a: any) => {
      const cat = (a.category || a.type || '').toLowerCase();
      return !['check-in', 'check-out', 'hotel', 'accommodation'].includes(cat);
    })
    .every((a: any) => a.isLocked);
```

**2. Update the button styling** (line 4402-4411):

When `allActivitiesLocked` is true and the day is NOT selected, apply an emerald/green background to signal completion. When selected, keep the primary color but add a green ring or checkmark:

- Not selected + complete: `bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800`
- Selected + complete: keep `bg-primary text-primary-foreground` but add a green check icon

**3. Add a small checkmark icon** (around line 4414, alongside the existing lock icon):

When `allActivitiesLocked` and not a credit-locked day, show a `CheckCircle2` icon in the top-right corner (replacing or alongside the lock icon position):
```tsx
{allActivitiesLocked && !(day.metadata?.isLocked && !isManualMode) && (
  <CheckCircle2 className="h-3 w-3 absolute top-1 right-1 text-emerald-500" />
)}
```

**4. Replace "Unplanned" label logic** (line 4456):

When `allActivitiesLocked`, show "Planned" in green instead of hiding the label:
```tsx
{allActivitiesLocked && !isTodayDay && !(day.metadata?.isLocked && !isManualMode) && (
  <span className="text-[9px] mt-0.5 font-medium text-emerald-500">Planned</span>
)}
```

### Summary
- Green fill + checkmark on day pills where all activities are locked
- Blue remains for currently selected day
- "Planned" label appears on completed days; "Unplanned" on empty days
- No changes to the per-day lock/unlock mechanics themselves

