

## Fix: "Dinner Spot" Placeholders + Last 2 Days Always Unplanned

### Problem Analysis

Two recurring issues identified:

**Issue 1: Generic meal placeholders ("dinner spot in Osaka", "lunch spot in Osaka")**
- The AI generates 3 retry attempts per day. If all 3 fail to include real restaurant names, the `enforceRequiredMealsFinalGuard` (day-validation.ts line 599) fires and injects generic fallbacks like `"Dinner at a restaurant"` with `needsRefinement: true` and `tags: ['meal-guard']`.
- These fallback titles come from `getDestinationHint()` (line 556-596) which only returns generic suffixes like "café near your hotel" and "neighborhood restaurant".
- The `generateSingleDayWithRetry` path (index.ts line 2897) correctly retries on non-last attempts when the meal guard fires, but the `generate-day` path (index.ts line 10434) does NOT retry — it just injects the placeholder immediately.
- As the trip gets longer, the `previousDayActivities` array grows (200+ items by day 8-10), bloating the prompt. This causes the AI to truncate or lazily generate meals for later days.

**Issue 2: Last 2 days always "Unplanned"**
- The chain (`generate-trip-day`) calls `generate-day` via HTTP. By day 4-5 of a multi-city leg, the inner call is more likely to 502/timeout because:
  - The `previousDayActivities` prompt section grows with every day
  - The `generation_context` metadata payload grows
  - Edge function wall clock approaches limits
- When the inner call fails, the chain marks the day as failed and continues, but if it's the last days, the trip gets marked `partial` or the chain breaks entirely.
- The padding logic (index.ts line 4160) then creates `status: 'placeholder'` days with empty activities, which the UI shows as "Unplanned".
- The self-heal in TripDetail.tsx (line 1198) only triggers for days with `activities.length === 0`, and it works — but the regeneration for those days ALSO often fails because the prompt is just as bloated.

### Root Causes

1. **Prompt bloat on later days**: `previousDayActivities` sends ALL previous activity titles (100+ by day 5). This bloats the prompt by 2-4K chars, pushing the AI toward truncation.
2. **No real venue lookup in the meal guard**: The fallback just generates generic text instead of querying the `verified_venues` table or using destination-specific data.
3. **The `generate-day` action path has no meal retry**: Only `generateSingleDayWithRetry` retries on meal guard failure. The direct `generate-day` action just accepts placeholders.
4. **Chain timeout cascade**: Later days take longer (bigger prompt), making 502s more likely, making more days fail.

### Changes

#### 1. Cap `previousDayActivities` to prevent prompt bloat
**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (~line 200-210)
- Cap `previousActivities` to the last 3 days' worth of activities (max ~30 items) instead of ALL previous days
- This keeps the "don't repeat" context relevant while preventing prompt size from growing unboundedly
- For uniqueness enforcement, the `day-validation.ts` dedup still catches trip-wide repeats post-generation

#### 2. Cap `previousDayActivities` in the generate-day action too
**File: `supabase/functions/generate-itinerary/index.ts`** (~line 8884)
- Where `previousDayActivities` is injected into the prompt, cap it to the last 40 items with a note: "Plus N more from earlier days — avoid all previous venues"
- This prevents the AI from seeing a 200-item avoid list that causes it to give up and output generic names

#### 3. Upgrade the meal guard fallback to use real venue data
**File: `supabase/functions/generate-itinerary/day-validation.ts`** (~line 599-668)
- Before falling back to generic text, query the `verified_venues` table for real restaurants in the destination
- If found, use a real venue name + address instead of "café near your hotel"
- If no verified venues exist, use the existing `getDestinationHint()` but with destination-specific real restaurant names from a hardcoded map for top destinations (Tokyo, Osaka, Kyoto, Paris, London, NYC, etc.)
- This is an async change, so `enforceRequiredMealsFinalGuard` needs an async variant or the lookup happens before the guard is called

Since `enforceRequiredMealsFinalGuard` is called synchronously in multiple places and changing it to async would require refactoring all call sites, a better approach:

**Alternative for #3**: Pre-fetch real venue candidates BEFORE the meal guard runs
- In `action-generate-trip-day.ts` (before the meal compliance guard at line 570), query `verified_venues` for the destination's dining venues
- Pass these as a `fallbackVenues` parameter to `enforceRequiredMealsFinalGuard`
- The guard uses real venue names from this list instead of generic text
- Same approach in `index.ts` generate-day path and `action-save-itinerary.ts`

#### 4. Add meal retry to the generate-day action path
**File: `supabase/functions/generate-itinerary/index.ts`** (~line 10434-10450)
- The `generate-day` action currently calls `enforceRequiredMealsFinalGuard` and accepts whatever it returns
- Add a single retry: if the meal guard fires (not compliant), and we haven't retried yet, loop back to the AI call with explicit "MISSING MEALS" feedback — same pattern as `generateSingleDayWithRetry` (line 2897-2916)

#### 5. Improve chain resilience for later days
**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (~line 247-318)
- Reduce the inner generate-day timeout from 150s to 120s for days 1-3, and increase it for later days (day 4+) which are known to take longer due to richer context
- On the first 502/timeout failure for day 4+, add a "slim prompt" retry that sends only the last 2 days of `previousDayActivities` instead of the capped list

### Files to change

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Cap previousActivities to last 3 days; pre-fetch dining venues for meal guard; adjust timeout for later days |
| `supabase/functions/generate-itinerary/index.ts` | Cap previousDayActivities in prompt; add meal retry to generate-day action path |
| `supabase/functions/generate-itinerary/day-validation.ts` | Accept optional `fallbackVenues` in `enforceRequiredMealsFinalGuard`; use real venue names instead of generic text |

### Expected outcome
- Prompt size stays constant regardless of trip length (no more bloat on day 8+)
- Meal placeholders use real restaurant names from the venue database
- The generate-day path retries once on meal guard failure before accepting fallbacks
- Later days are less likely to timeout because the prompt is smaller
- "Unplanned" days become rarer because the chain completes more reliably

