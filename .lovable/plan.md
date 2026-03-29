

## FIX 6: Meal Time Ordering Validation in `sanitizeGeneratedDay`

### What's Happening
Activities use `startTime`/`endTime` fields (not `time`). The AI generates "Lunch at Chorus Café" at 19:10 and "Dinner at Palazzo Fendi" at 19:00. The existing meal coherence check in `generation-core.ts` would rename "Lunch" → "Dinner" (since 19:10 is in dinner range), but it doesn't prevent two dinners or fix the root ordering issue. The sanitization layer (`sanitizeGeneratedDay`) currently does no meal time validation.

### Changes — Single File

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Add meal time validation at the end of `sanitizeGeneratedDay`, just before `return day;` (line 171):

1. **Detect misplaced meals**: If a title contains "lunch" and `startTime` hour is ≥ 17, reassign `startTime` to `12:30` and `endTime` to `13:30`. If "breakfast" and hour ≥ 14, reassign to `08:00`/`09:00`.

2. **Re-sort activities by startTime**: After correcting meal times, sort `day.activities` by `startTime` using simple string comparison (already 24h `HH:MM` format from upstream normalization).

This catches cases that slip through `generation-core.ts` meal coherence (which only relabels but doesn't move time slots).

### What's NOT Changing
- `generation-core.ts` — existing meal coherence relabeling stays as-is
- `index.ts` — untouched
- No new files

### Verification
Generate a multi-day itinerary. No "Lunch" should appear after 17:00, no "Breakfast" after 14:00, and activities should be chronologically sorted.

