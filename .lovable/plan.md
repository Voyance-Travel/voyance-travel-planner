

## Nuclear Placeholder Elimination — Generation-Level Fix

### Root Cause

The validate/repair pipeline in `action-generate-day.ts` (~line 787-889) is inside a `try/catch` that silently swallows errors. If ANY part of validation or repair throws, all placeholder fixes are skipped and the raw AI output (with placeholders) goes straight to persist. Additionally, the fallback restaurant DB in `repair-day.ts` lacks descriptions and prices, producing low-quality replacements.

### Changes

#### 1. Add unconditional inline placeholder rejection in `action-generate-day.ts`

Insert a new block at ~line 326 (after activity normalization, BEFORE enrichment and validate/repair). This runs outside the validate/repair try/catch, so it ALWAYS executes.

- Define `PLACEHOLDER_TITLE_PATTERNS` (11 regexes covering "at a bistro", "at a brasserie", "at a café", "at a boulangerie", "at a neighborhood", "at a local", "at a nearby", "at a restaurant")
- Define `PLACEHOLDER_VENUE_PATTERNS` (regexes for city names, "the destination", "get a restaurant recommendation")
- Loop through all dining activities, detect placeholders by title OR venue OR description
- Replace with a random fallback from a new `getRandomFallbackRestaurant()` function (defined in the same file)
- Track used venue names in a Set to prevent duplicates within the same day
- Log every replacement with `console.error("PLACEHOLDER DETECTED: ...")`

The fallback database will include Paris (6 breakfast, 6 lunch, 6 dinner), Rome (3/3/3), Berlin (3/3/3) with full descriptions and prices — richer than the existing repair-day.ts entries.

#### 2. Move restaurant naming rules to TOP of system prompt in `compile-prompt.ts`

Currently the "RESTAURANT NAMING RULES" block is at line ~847, buried after 800+ lines of other instructions. Move the critical "ABSOLUTE RULE — REAL RESTAURANTS ONLY" block to the very beginning of the system prompt string, before archetype guidance and schema sections. The AI prioritizes early instructions.

#### 3. Expand fallback DB in `repair-day.ts` with descriptions and prices

Update the existing `FallbackVenue` interface to include `description` and `price` fields. Enrich existing Paris, Rome, Berlin entries (and add a few more per city) so that repaired venues don't get the generic "Local dining in the city center" description.

#### 4. Pass `usedVenueNames` from trip-day orchestrator to day generator

In `action-generate-trip-day.ts`, after each day is generated (~line 530), collect all venue names from the day's dining activities into the running used-restaurants list. Pass this to the next day's `generate-day` call so the inline placeholder replacer can avoid cross-day duplicates.

### Files to edit

| File | Change |
|------|--------|
| `action-generate-day.ts` | Add inline placeholder rejection block + fallback restaurant DB + `getRandomFallbackRestaurant()` after normalization (~line 326) |
| `pipeline/compile-prompt.ts` | Move restaurant naming rules to top of system prompt |
| `pipeline/repair-day.ts` | Add `description` and `price` to `FallbackVenue` interface; enrich existing entries |
| `action-generate-trip-day.ts` | Accumulate dining venue names after each day completes; already passes usedRestaurants |

### What we're NOT changing

- The validate/repair pipeline itself (it's a second safety net)
- The AI model or tool schema
- The meal policy or meal guard
- Any frontend code

