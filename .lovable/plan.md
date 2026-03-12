

## Fix: 4 Bugs Causing Sparse/Empty Itinerary Generation

### What's happening

The itinerary generation appears stuck or produces empty/sparse results because of 4 concrete bugs working together:

### Bug 1: `PERPLEXITY_API_KEY` is not defined in schema path
**Line 8263** references `PERPLEXITY_API_KEY` but it's only declared inside the old `generateDay()` function (lines 4798, 4969). The schema path (starting ~line 6400) never declares it.

**Fix**: Add `const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");` before the schema compilation block, or inline `Deno.env.get("PERPLEXITY_API_KEY")` at line 8263.

### Bug 2: Auto-correction overwrites breakfast with US Open times
In `schema-validator.ts` line 118, `checkFilledSlotIntegrity` matches activities by `a.startTime === data.startTime`. When both breakfast and US Open start at `09:00`, the validator matches breakfast to the US Open's filled slot and overwrites breakfast's endTime from `10:45` to `18:00` (the US Open's endTime).

**Fix**: Match by title first, only fall back to time if no title match exists. Change the matching logic to:
```
const matchIdx = corrected.findIndex(
  a => a.title?.toLowerCase().includes(data.title.toLowerCase().substring(0, 15))
);
if (matchIdx === -1) {
  // fallback: match by time + category similarity
}
```

Both `schema-validator.ts` (edge function) and `src/lib/schema-compiler/schema-validator.ts` (source of truth) need updating.

### Bug 3: External-ID upsert fails — activities don't persist
The unique index `idx_itinerary_activities_external_id` is a **partial** index (`WHERE external_id IS NOT NULL`). Postgres doesn't allow `ON CONFLICT` with partial unique indexes via the Supabase client. Some `externalRows` may also have `null` external_id (when `act.id` is undefined).

**Fix** (line 9903-9925):
1. Filter out rows with null `external_id` before the upsert
2. For null-external-id rows, use a plain `.insert()` instead of `.upsert()`

### Bug 4: HIGH severity validation doesn't trigger retry
Line 8728-8731: When validation severity is `high` (e.g., AI returned 4 activities for 8 slots), the code only logs a warning but doesn't retry. The AI call retry loop (line 8437) only retries on HTTP errors, not on validation failures.

**Fix**: After validation, if severity is `high`, increment a counter and `continue` the retry loop (up to 1 extra attempt for validation failures). This requires minor restructuring of the retry loop to include validation inside it.

### Files to modify

1. **`supabase/functions/generate-itinerary/index.ts`**
   - Add `PERPLEXITY_API_KEY` declaration before line 8261
   - Fix external-id upsert (lines 9903-9932): filter nulls, use insert for null-id rows
   - Add validation-based retry (wrap validation inside the retry loop)

2. **`supabase/functions/generate-itinerary/schema/schema-validator.ts`** — Fix title-first matching in `checkFilledSlotIntegrity`

3. **`src/lib/schema-compiler/schema-validator.ts`** — Same fix (source of truth)

### Impact
These 4 fixes address:
- Activities silently failing to save (Bug 3)
- Breakfast getting corrupted to 9-hour spans (Bug 2) 
- No retry when AI returns too few activities (Bug 4)
- Missing destination context making AI less informed (Bug 1)

