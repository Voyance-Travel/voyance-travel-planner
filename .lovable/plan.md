

## Fix Timing Overlaps — Final Safety Net

### The Problem
Activities can overlap (e.g., spa 5:55–7:25 PM, dinner 7:00 PM) because the repair pipeline runs before the universal quality pass, and the quality pass can re-introduce timing conflicts without fixing them.

### Analysis
- `action-generate-day.ts` already has an inline TIME OVERLAP FIXER (lines 520–542) that runs after the quality pass.
- `action-generate-trip-day.ts` does NOT have this — it relies solely on `repair-day.ts` (step 13), which runs BEFORE the universal quality pass and restaurant dedup. Any timing changes made after the repair pipeline are unguarded.

### The Fix (1 file)

#### `action-generate-trip-day.ts` — Add timing overlap fixer after universal quality pass (~line 1191)

Insert the same overlap repair block that `action-generate-day.ts` already uses. Place it right after the universal quality pass completes (after line 1191), before the stage logger flush:

- Sort activities by start time
- Walk the sorted list; if activity N starts before activity N-1 ends, shift N forward to `prevEnd + 15` minutes
- Preserve activity duration when shifting
- Log each shift

This mirrors the existing pattern in `action-generate-day.ts` lines 520–542 and acts as a final safety net after all other processing.

### Files Changed
1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — add inline timing overlap fixer after universal quality pass

