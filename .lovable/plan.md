

## Fix Midnight Entry Cascade on Day 1

### Problem
Day 1 starts with phantom midnight entries (12:05 AM "Return to Hotel", 1:05 AM "Check-in") that cascade the entire timeline into early morning hours. The existing midnight stripper at sanitization.ts lines 413-433 has gaps: it only strips if ALL pre-dawn entries are hotel-typed, and doesn't check alternate time field names (`time`, `start_time`).

### Changes

**File: `supabase/functions/generate-itinerary/sanitization.ts`** (~lines 413-433)

Replace the existing midnight phantom stripper with the broader approach from the prompt:

- Check `activity.time`, `activity.start_time`, AND `activity.startTime` for the hour
- Strip pre-dawn (00:00–04:59) hotel-related entries sequentially from the start of the day — stop at the first non-hotel or non-midnight entry
- Use a wider title regex: `return to|check.?in|check.?out|hotel|freshen up|rest and refresh|retire|settle|wind down|end.?of.?day|back to`
- Also match `category === 'accommodation'` or `category/type === 'stay'`
- Log each removal for diagnostics

**File: `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`** (~line 898, after the existing timing rules)

Add after the "Activities must flow logically" line:

```
- Do NOT include "Return to Hotel" entries at the START of any day.
- Do NOT include any activities between 12:00 AM and 6:00 AM unless they are specifically planned late-night activities from the CURRENT day.
- Day 1 should begin with arrival or the first morning activity (typically 8:00-9:00 AM), never with midnight hotel entries.
```

### Files to edit
- `supabase/functions/generate-itinerary/sanitization.ts` — strengthen midnight phantom stripper
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — add timing rules to prompt

### Verification
Generate a 4-day Lisbon trip. Day 1 should start around 8:00–9:00 AM. No day should have phantom midnight hotel entries at the start.

