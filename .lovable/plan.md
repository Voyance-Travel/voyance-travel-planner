

## Fix: Wire Up Must-Do Post-Generation Validation (Part 6)

Parts 1-5 of this fix are already implemented from previous messages. The remaining piece is Part 6: wiring `validateMustDosInItinerary` into the post-generation validation pipeline.

### Current State
- `validateMustDosInItinerary` exists in `must-do-priorities.ts` (line 729) but is never imported or called in `generate-itinerary/index.ts`
- `parseMustDoInput` and `scheduleMustDos` are already imported (line 143-151)
- The full-trip generation pipeline has validation stages (2.5 through 4.9) but no must-do validation stage
- The per-day generation path builds `mustDoPrompt` and `mustDoEventItems` but never validates the output

### Changes

**File: `supabase/functions/generate-itinerary/index.ts`**

**6A: Add `validateMustDosInItinerary` to the existing import** (line 143-151)
- Add `validateMustDosInItinerary` to the import from `./must-do-priorities.ts`

**6B: Add must-do validation after Stage 2.7 / before Stage 3 early save** (~line 8982)
- Insert a new Stage 2.8 that:
  1. Checks if `context.mustDoActivities` exists
  2. Parses it with `parseMustDoInput`
  3. Validates against `aiResult.days` using `validateMustDosInItinerary`
  4. Logs warnings for any missing must-do items (matching how opening hours violations are logged)
  5. Does NOT block generation — logging only for now (same pattern as Stage 2.6 personalization validation)

**6C: Add must-do validation in per-day generation path** (~after line 9733, where mustDoPrompt processing ends)
- After the generated day activities are available, validate that must-do items assigned to this day are present in the output
- Log warnings for missing items

This is a logging/observability-only change — no generation blocking, no data model changes. It mirrors the pattern used by opening hours validation (Stage 4.5) and personalization validation (Stage 2.6).

