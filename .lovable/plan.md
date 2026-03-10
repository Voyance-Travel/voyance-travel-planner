

## Fix: Date Drift in "Just Tell Us" Flow

### Problem

Users specify exact dates in the chat (e.g., "March 20-23") but the trip ends up with different dates. There are three contributing issues:

### Root Causes

1. **`formatDate` in generate-itinerary uses UTC parsing** (line 1124-1128 of `generate-itinerary/index.ts`):
   ```typescript
   function formatDate(startDate: string, dayOffset: number): string {
     const date = new Date(startDate);        // UTC midnight parse
     date.setDate(date.getDate() + dayOffset); // mixes local getDate with UTC parse
     return date.toISOString().split('T')[0];  // UTC output
   }
   ```
   `new Date("2026-03-15")` is parsed as UTC midnight. Then `getDate()` returns the local day and `toISOString()` outputs UTC — this mismatch can shift day-dates by ±1 depending on server timezone.

2. **Server-side `todayStr` in `chat-trip-planner` uses UTC** (line 18): The AI receives `TODAY'S DATE` based on server UTC, which can be a day ahead of users in western timezones. This can cause the AI to misinterpret "today" or relative dates like "this Friday."

3. **Double normalization is harmless but adds no logging** — `normalizeChatTripDates` runs in both `TripChatPlanner.tsx` and `Start.tsx`. While idempotent, there's no logging to detect when dates are actually shifted, making debugging difficult.

### Plan

**1. Fix `formatDate` in `generate-itinerary/index.ts` — use timezone-safe local parsing**

Replace the UTC-based `formatDate` with a version that uses component-based date parsing (same pattern as `parseLocalDate` and `calculateDays` already use):

```typescript
function formatDate(startDate: string, dayOffset: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**2. Add diagnostic logging in `Start.tsx` when dates are shifted**

After `normalizeChatTripDates` runs, log a warning if the guarded dates differ from what the AI returned — this will make future drift issues immediately visible:

```typescript
if (guardedDates.startDate !== details.startDate || guardedDates.endDate !== details.endDate) {
  console.warn('[Start] Date guard shifted dates:', {
    original: { start: details.startDate, end: details.endDate },
    guarded: guardedDates,
  });
}
```

**3. Remove the redundant second `normalizeChatTripDates` call in `Start.tsx`**

Since `TripChatPlanner.tsx` already normalizes dates before setting `extractedDetails` (line 228-230), the second call in `Start.tsx` (line 2704) is redundant. Removing it eliminates a potential source of confusion and simplifies the flow. Instead, just use `details.startDate` / `details.endDate` directly (they're already guarded).

**4. Add same-style diagnostic logging in `TripChatPlanner.tsx`**

Log when `normalizeChatTripDates` actually changes dates so drift from the AI model is immediately visible in console.

