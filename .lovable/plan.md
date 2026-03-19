

## Fix: Trip duration shows "4 days" instead of "5 days"

### Root cause

`differenceInDays(endDate, startDate)` returns the exclusive difference (e.g., Jan 1 to Jan 5 = 4). Trip duration should be inclusive (5 days). Some places in the codebase already add `+1`, but several do not.

### Changes

**1. `src/components/planner/TripStatusCards.tsx` (line 27)**
Change `differenceInDays(parseLocalDate(endDate), parseLocalDate(startDate))` → add `+ 1`.

**2. `src/components/trips/TripOverview.tsx` (line 109)**
Change `totalDays = differenceInDays(end, start)` → `differenceInDays(end, start) + 1`. The `currentDayNumber` and progress calculations on lines 110-112 already use this `totalDays`, so they'll automatically be correct.

**3. `src/pages/ActiveTrip.tsx` (line 328)**
Same fix: `totalDays = differenceInDays(end, start) + 1`.

**4. `src/hooks/useFeedbackTrigger.ts` (line 61)**
Same fix: `totalDays = differenceInDays(end, start) + 1`.

All four locations need `+ 1` to match the inclusive day count already used in `TripDetail.tsx` (line 2276) and `Start.tsx` (line 866).

