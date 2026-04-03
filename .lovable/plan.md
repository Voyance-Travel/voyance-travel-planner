

## Fix: Deduplicate Back-to-Back Accommodation Cards

### Problem
After dinner, the repair pipeline can produce two consecutive hotel activities — e.g., "Freshen Up at Hotel" followed by "Return to Hotel" — because:
1. Step 1 injects "Freshen Up" when it finds a transport-to-hotel without a following accommodation card
2. Step 2 injects "Return to Hotel" at the end if the last visible non-transport activity isn't accommodation
3. The AI itself may also generate one of these, leading to duplicates

These steps don't coordinate — each checks independently, so you end up with redundant hotel cards.

### Fix

**File: `supabase/functions/generate-itinerary/pipeline/repair-day.ts`**

Add a **post-bookend deduplication pass** (after step 2, before step 2.5) that:

1. Scans activities for consecutive accommodation cards (ignoring transport cards between them)
2. When two back-to-back accommodation activities are found (both hotel-related, neither is check-in or checkout):
   - Keep the **last** one (which is typically "Return to Hotel" — the more meaningful end-of-day anchor)
   - Remove the earlier one and any transport card leading to it
3. Special case: if one is "Freshen Up" and the other is "Return to", keep "Return to" since "freshen up" after the last activity of the day is redundant — you're returning for the night, not a mid-day break

This ensures only one hotel anchor appears at the end of the day, and mid-day freshen-ups only survive when there are real activities after them.

### Expected behavior

| Before | After |
|---|---|
| Dinner → Transport → Freshen Up → Transport → Return to Hotel | Dinner → Transport → Return to Hotel |
| Activity → Transport → Return to Hotel → Freshen Up | Activity → Transport → Return to Hotel |

### Files changed
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add back-to-back accommodation dedup pass

