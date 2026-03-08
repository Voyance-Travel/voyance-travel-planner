

## Plan: Post-Validation Deduplication for Generated Itineraries

### Problem
Duplicate activities (e.g., "Marble Mountains Exploration" at 10:05 AM and 10:20 AM) slip through when the AI stubbornly regenerates the same duplicate across all retry attempts. The last-attempt escape clause at line 5857 accepts the day with errors.

### Fix — 3 layers

**File: `supabase/functions/generate-itinerary/index.ts`**

1. **Add `deduplicateActivities()` function** (after line ~4707, after `validateGeneratedDay`):
   - Normalizes titles, extracts concepts, tracks seen concepts + locations
   - Keeps first occurrence, removes subsequent duplicates
   - Skips repeatable categories (transport, accommodation, downtime)
   - Uses same `normalizeText`/`extractConcept` logic as validation
   - Returns `{ day, removed[] }`

2. **Call dedup before returning day** (line 5857-5871):
   - After validation passes (or last attempt accepts), run `deduplicateActivities(generatedDay)` 
   - Log removed duplicates: `[Stage 2] Day N: Removed X duplicate(s): ...`
   - Replace `generatedDay` with deduped version before tagging multi-city info and returning
   - This single insertion point covers both full-trip and per-day (`generate-day`/`regenerate-day`) paths since both go through `generateSingleDayWithRetry`

**File: `supabase/functions/optimize-itinerary/index.ts`**

3. **Title-based dedup after gap filling** (after line 2178, Step 9):
   - Simple `seenTitles` Set filter on activities
   - Skip transport/accommodation/downtime categories
   - Safety net for any duplicates that survive into the optimize pass

### Deployment
Both edge functions will be redeployed after editing.

