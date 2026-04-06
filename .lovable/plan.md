

## Deduplicate Consecutive Hotel Return Activities

### Problem
Day 1 of Trip 0c84133e has two back-to-back "Return to Four Seasons Ritz" activities (12:28–12:43 AM and 12:43–12:58 AM). Only one should exist.

### Plan

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Insert a consecutive hotel-return dedup pass after the midnight phantom strip (line 758) and before the hotel name mismatch fix (line 760). This runs before the fine dining dedup.

Logic:
- Walk activities from index 1. If both current and previous are STAY category with "return to / retire to / back to / freshen up" in the title, and they reference the same hotel (same venue_name or same title), remove the duplicate.
- Log `DUPLICATE HOTEL RETURN` when removing.

**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`**

Add a prompt instruction in the hotel/accommodation rules section:
- "Include exactly ONE Return to [Hotel] activity at the end of each day. Never generate two consecutive return-to-hotel activities."

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Add consecutive hotel return dedup after midnight strip (~line 759) |
| `compile-prompt.ts` | Add single-return-to-hotel prompt rule |

No new files.

