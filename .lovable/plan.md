

## Fix 23C: Post-Generation Gap Filler

### What It Does
Detects schedule gaps longer than 90 minutes between activities and injects logical filler activities (transport, hotel freshen-up, dinner) to create realistic day plans.

### New Files (2)

**`src/lib/schema-compiler/gap-filler.ts`** and **`supabase/functions/generate-itinerary/schema/gap-filler.ts`** (Deno copy)

Contains:
- `detectAndFillGaps(activities, config)` — scans sorted activities for gaps ≥ 90 min
- Gap ≥ 180 min → transport + hotel freshen-up + dinner + transport
- Gap 120–179 min → dinner + transport
- Gap 90–119 min → quick dinner only
- Helper time utilities (timeToMinutes, minutesToTime, getEndTimeMinutes)

Implementation follows the user's spec with one adjustment: time format output will use HH:MM (24-hour) to match the AI's output format and `parseTimeToMinutes` already used throughout `index.ts`, avoiding format mismatches during the sort step.

### Integration Point

**`supabase/functions/generate-itinerary/index.ts`** — Insert gap filler call at line ~8595, after locked activities are merged and sorted, and before the enrichment step (line 8597). This is the natural place because all activities (AI-generated + locked) are finalized here.

```
// After line 8594 (locked merge log) / before line 8596 (enrichment step):
const gapFillerConfig = {
  minGapMinutes: 90,
  hotelName: hotelContext?.name,
  hotelLocation: hotelContext?.address,
  budgetTier: /* extract from archetypeContext */ 'mid',
  transportMinutes: 30,
};
const { fillerActivities, gaps } = detectAndFillGaps(normalizedActivities, gapFillerConfig);
if (fillerActivities.length > 0) {
  normalizedActivities.push(...fillerActivities);
  normalizedActivities.sort(by startTime);
}
```

### Export Updates (2 files)
- `src/lib/schema-compiler/index.ts` — add `detectAndFillGaps` export
- `supabase/functions/generate-itinerary/schema/index.ts` — same

### Files Changed: 5
1. `src/lib/schema-compiler/gap-filler.ts` — **NEW**
2. `supabase/functions/generate-itinerary/schema/gap-filler.ts` — **NEW** (Deno copy)
3. `src/lib/schema-compiler/index.ts` — add export
4. `supabase/functions/generate-itinerary/schema/index.ts` — add export
5. `supabase/functions/generate-itinerary/index.ts` — call gap filler after activity merge

