

## Fix: Check-in/Check-out Dates Not Shown for First Hotel

### Problem

The date fields (check-in date, check-out date) in the hotel modal are gated by `(isListMode || showMultiCityDates)` on line 2008. For the **first** hotel in a single-city trip, `isListMode` is `false` because `manualHotelList` is empty and `editingHotelIndex` is `null`. Dates only appear when adding a second hotel (split stay mode). This means the first hotel never gets explicit dates set.

### Fix

**`src/pages/Start.tsx`** — Always show the date fields in the hotel modal. Remove the conditional wrapper `{(isListMode || showMultiCityDates) && (` around the date inputs (lines 2008 and 2033). The dates should always be visible, defaulting to trip start/end (or city arrival/departure for multi-city). This gives users visibility and control over their stay dates from the first hotel onward.

| File | Change |
|---|---|
| `src/pages/Start.tsx` | Remove the `(isListMode \|\| showMultiCityDates)` conditional on lines 2008/2033 so date fields always render |

