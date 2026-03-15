

## Finding: Regenerate-Day Skips Trip-Wide Duplicate Validation

### Current State

The **full generation** path (action: `generate-trip`) calls `validateGeneratedDay()` at line 2599, which runs all the trip-wide dedup checks from `day-validation.ts` — including meal repeat detection, concept similarity, culinary class limits, etc. If duplicates are found, it retries generation with the errors fed back to the AI.

The **regenerate-day / generate-day** path (line 6474+) does **not** call `validateGeneratedDay()`. It only:
- Passes `previousDayActivities` as a soft "avoid repeating" prompt hint (line 8295-8315)
- Validates must-do items (line 9286-9308)
- Does structural checks (backfill, transition days, etc.)

This means when a user regenerates a single day, the AI receives a suggestion to avoid previous activities but there's **no validation loop** to catch and retry if it produces duplicates anyway.

### Fix Plan

**File: `supabase/functions/generate-itinerary/index.ts`** — In the `generate-day`/`regenerate-day` path, after the AI response is parsed and normalized (~line 8800-8930 area, before DB persistence at ~line 9100):

1. **Build `previousDays` from existing itinerary data** — The trip's `itinerary_data.days` is already fetched earlier in this path. Collect all days except the current `dayNumber` into the `previousDays` format that `validateGeneratedDay` expects.

2. **Call `validateGeneratedDay`** with the generated day, passing `previousDays` for trip-wide dedup.

3. **Add a retry loop** (max 1-2 retries) — If validation returns errors (e.g., `MEAL REPEAT`, `TRIP-WIDE DUPLICATE`), re-invoke the AI with the error feedback appended to the prompt, similar to how the full generation path works.

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add `validateGeneratedDay` call + retry loop in the `generate-day`/`regenerate-day` action path, after activity normalization and before DB persistence |

### Key Implementation Detail

The existing trip data is already loaded in this path for `previousDayActivities`. We need to restructure it into the `previousDays` array format (`{ activities: [{ title, category, ... }] }[]`) and call the same validation function used by the full generation path. The retry loop should be lightweight (1 retry max) to avoid latency on single-day regeneration.

