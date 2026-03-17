

## Fix: Travel Intelligence Showing Events Outside Trip Date Window

### Root Cause

Two issues combine:

1. **AI is unreliable at date filtering.** The Perplexity prompt says "events actually happening during those dates" but LLMs frequently return events slightly before or after the travel window (e.g., a festival ending the day before arrival, or one starting a week after departure).

2. **No client-side date validation.** `TravelIntelCard` renders the entire `eventsAndHappenings` array from the API response without checking whether each event's dates overlap with `startDate`/`endDate`. The event `dates` field is a freeform string (e.g., "March 15-17", "Every Saturday"), making exact filtering hard — but we can at least attempt a reasonable parse-and-filter.

### The Fix

**Add a client-side date filter in `TravelIntelCard` that removes events clearly outside the trip window, before rendering.**

**File: `src/components/itinerary/TravelIntelCard.tsx`**

1. Add a helper function `isEventInDateRange(eventDates: string, tripStart: string, tripEnd: string): boolean` that:
   - Extracts date-like patterns from the freeform `dates` string (e.g., "March 15-17", "June 3", "Every Saturday")
   - For recurring events ("Every ...", "Daily", "Weekends"), always returns `true` (they're inherently within-window)
   - For parseable dates, checks overlap with the trip window. Parses month+day against the trip's year context.
   - For unparseable strings, returns `true` (don't hide events we can't validate — false negatives are worse than false positives)

2. Before rendering `intel.eventsAndHappenings`, filter through this helper:
   ```
   const filteredEvents = intel.eventsAndHappenings.filter(
     ev => isEventInDateRange(ev.dates, startDate, endDate)
   );
   ```

3. Render `filteredEvents` instead of the raw array.

**Also strengthen the edge function prompt** (`supabase/functions/generate-travel-intel/index.ts`):

4. Add an explicit negative instruction to the system prompt:
   ```
   - Do NOT include events that end before ${startDate} or start after ${endDate}. 
     Every event MUST overlap with the travel window.
   ```

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/TravelIntelCard.tsx` | Add `isEventInDateRange` helper; filter events before rendering |
| 2 | `supabase/functions/generate-travel-intel/index.ts` | Strengthen prompt with explicit date boundary rule |

### Expected Result

- Events clearly outside the trip window are filtered out on the client side
- The AI prompt is more explicit about date boundaries, reducing out-of-range events at the source
- Recurring/unparseable events are kept (safe default)

