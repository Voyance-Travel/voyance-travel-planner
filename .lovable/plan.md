
# Fix: "Invalid time value" Crash When Filtering Restaurants

## Problem Analysis

The app crashes with "Invalid time value" when rendering the `AirportGamePlan` component. This happens because:

1. **Legacy hotel data** in the database has a `checkIn` field with a **time value** like `"3:00 PM"` (not a date)
2. The `normalizeLegacyHotelSelection()` function incorrectly uses this time value as `checkInDate`:
   ```typescript
   checkInDate: (hotel.checkInDate as string) || (hotel.checkIn as string) || tripStartDate
   ```
3. When the component renders, `parseISO("3:00 PM")` returns an invalid Date object
4. `format(invalidDate, 'MMM d')` throws "Invalid time value"

**Why restaurant filtering triggers the crash**: Any state change (like filtering) causes React to re-render the itinerary view, which re-renders `AirportGamePlan`, hitting the unsafe date formatting code.

---

## Solution Overview

We need to fix this at multiple levels:

1. **Fix the normalization function** to validate that `checkIn` is a valid ISO date before using it as `checkInDate`
2. **Add defensive date formatting** in `AirportGamePlan` with try/catch
3. **Add a utility function** for safe date formatting that returns a fallback on invalid dates

---

## Technical Changes

### 1. Fix `hotelValidation.ts` - Validate Date Format

Update `normalizeHotel()` to only use `checkIn` as `checkInDate` if it's a valid ISO date (contains hyphens and has the right format):

```typescript
function isValidISODate(str: string): boolean {
  // Must match YYYY-MM-DD format
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// In normalizeHotel():
checkInDate: (hotel.checkInDate as string) || 
  (isValidISODate(hotel.checkIn as string) ? hotel.checkIn as string : null) || 
  tripStartDate,
```

### 2. Add Safe Date Formatting Utility

Create a helper function that safely formats dates with a fallback:

```typescript
export function safeFormatDate(
  dateString: string | undefined | null,
  formatStr: string,
  fallback: string = ''
): string {
  if (!dateString) return fallback;
  try {
    const date = parseISO(dateString);
    if (isNaN(date.getTime())) return fallback;
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}
```

### 3. Update `EditorialItinerary.tsx` - Safe Date Formatting

Replace the unsafe `format(parseISO(...))` call in `AirportGamePlan`:

**Before:**
```typescript
Check-in: {format(parseISO(hotelSelection.checkInDate), 'MMM d')}
```

**After:**
```typescript
Check-in: {safeFormatDate(hotelSelection.checkInDate, 'MMM d', 'Date TBD')}
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/utils/hotelValidation.ts` | Add `isValidISODate()` check, fix `normalizeHotel()` |
| `src/utils/dateUtils.ts` | New file with `safeFormatDate()` utility |
| `src/components/itinerary/EditorialItinerary.tsx` | Use `safeFormatDate()` in `AirportGamePlan` |

---

## Database Impact

The fix handles existing data gracefully:
- Hotels with `checkIn: "3:00 PM"` will now use `tripStartDate` as `checkInDate`
- Hotels with proper `checkInDate: "2026-03-05"` continue to work
- UI shows "Date TBD" for any remaining invalid dates

No database migration needed - the normalization happens at runtime.
