

# Fix: Show all expected days during generation, with "still working" placeholders

## Problem
When a multi-day trip leg (e.g., Apr 3–5 = 3 days) is generating, the `days` array only contains days that have been generated so far (e.g., 1 day). The UI uses `days.length` everywhere, so it shows "1 day · Apr 3 – Apr 5" and "Day 1 of 1" with no indication that 2 more days are coming.

## Root Cause
The component has `startDate` and `endDate` props (which define the full trip window) but never computes an expected day count from them. All day-count displays and the day picker tabs are driven solely by `days.length`.

## Fix

### 1. Compute expected total days from dates (`EditorialItinerary.tsx`)
Add a derived value early in the component:
```typescript
const expectedTotalDays = useMemo(() => {
  if (!startDate || !endDate) return days.length;
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(diff, days.length);
}, [startDate, endDate, days.length]);
```

### 2. Update day count display (line ~4842)
Change the "X day(s)" label to show expected total when generating:
```
// From:
{days.length} day{days.length !== 1 ? 's' : ''}

// To:
{isActivelyGenerating ? expectedTotalDays : days.length} day{...}
```

### 3. Update "Day X of Y" display (line ~4876)
```
// From:
Day {selectedDayIndex + 1} of {days.length}

// To:  
Day {selectedDayIndex + 1} of {isActivelyGenerating ? expectedTotalDays : days.length}
```

### 4. Add placeholder day tabs for not-yet-generated days (line ~4898)
After the `days.map(...)` loop that renders day buttons, append placeholder tabs for days that haven't been generated yet:
```tsx
{isActivelyGenerating && days.length < expectedTotalDays && (
  Array.from({ length: expectedTotalDays - days.length }, (_, i) => {
    const pendingDayNumber = days.length + i + 1;
    const dayDate = addDays(parseLocalDate(startDate), pendingDayNumber - 1);
    return (
      <div key={`pending-${pendingDayNumber}`}
        className="flex flex-col items-center px-3 py-2 rounded-xl min-w-[72px] border border-dashed border-border/50 bg-muted/20 opacity-60"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Day {pendingDayNumber}
        </span>
        <span className="text-lg font-bold leading-tight text-muted-foreground">{dayDate.getDate()}</span>
        <span className="text-[10px] text-muted-foreground">{format(dayDate, 'EEE')}, {format(dayDate, 'MMM')}</span>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mt-0.5" />
      </div>
    );
  })
)}
```

### 5. Show "Still generating..." message in the day content area
When user selects a day index beyond `days.length - 1`, or when viewing the currently generating state with pending days, show a message. The existing placeholder at line ~5234 already handles this for locked days during generation — we just need to ensure the pending tabs are not clickable or that selecting them shows the generating message.

## Files Changed

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Compute `expectedTotalDays`, update count labels, add placeholder day tabs with spinner |

