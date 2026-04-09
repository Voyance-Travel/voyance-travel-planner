

# Lock / Enhance / Verify Lock for User-Specified Activities

## Problem
When users provide detailed day-by-day itineraries in "Just Tell Us" with exact times, venues, and restaurants, the generation pipeline can drift, rename, reorder, or drop their content through AI generation, hallucination filters, cross-day dedup, sanitization, and enrichment.

## Current State
- `perDayActivities` is parsed and injected as a prompt instruction (compile-prompt.ts lines 219-235) telling the AI to "follow this schedule"
- `userSpecifiedNames` set (action-generate-trip-day.ts lines 851-876) protects user venues from the hallucination filter
- `enrich-day.ts` already skips `isLocked` activities (line 42)
- But: the AI still generates ALL activities (including user-specified ones), so drift happens. Post-processing filters (filler, wellness, dedup, sanitization) can also modify or remove them.

## Plan

### 1. Add `lockedCards` field to `CompiledPrompt` interface
**File: `compile-prompt.ts`** — Add `lockedCards: any[]` to the `CompiledPrompt` interface so locked cards flow from prompt compilation to the orchestrator.

### 2. Build locked cards from `perDayActivities` (LOCK phase)
**File: `compile-prompt.ts`** — Add helper functions `parseUserActivities()`, `normalizeTime()`, `detectCategory()`, and `findTimeGaps()` near the top. In the `perDayActivities` block (lines 219-235):
- Parse user text into structured locked activity cards with `locked: true` and `lockedSource` preserving the original text
- TBD entries remain as AI hints, not locked
- Build a "PRE-FILLED TIMELINE" showing the AI what's locked, and "OPEN TIME GAPS" for what the AI should fill
- Store locked cards on the returned `CompiledPrompt`

### 3. Inject locked cards after AI generation (merge)
**File: `action-generate-trip-day.ts`** — After the AI response is parsed (~line 880 area, after hallucination filter):
- Add `mergeLockedCards()` function that inserts locked cards into the activity list, discarding any AI-generated activities that overlap locked time slots
- Read `lockedCards` from the compiled prompt context

### 4. Skip locked cards in ALL post-processing filters
**File: `action-generate-trip-day.ts`** — Add `if (activity.locked) continue/return true` guards in:
- Hallucination filter (line 917) — already partially protected via `userSpecifiedNames`, but locked flag is more robust
- Filler activity filter (~line 988)
- Wellness limiter (~line 1020)
- Cross-day venue dedup (~line 1066)
- Cross-day restaurant dedup (~line 1306)
- Departure day cutoff (~line 1041)

### 5. Enrichment: geocode-only for locked cards
**File: `enrich-day.ts`** — Already skips `isLocked` activities. Add similar handling for `locked` flag: attempt geocoding for transit calculation but never overwrite name, title, or address.

### 6. Verify lock integrity (VERIFY phase)
**File: `action-generate-trip-day.ts`** — Add `verifyLockedCards()` as the absolute last step before the save block (~line 1447):
- Compare final activities against original locked cards by `lockedSource`
- Restore any dropped locked cards
- Fix any title, time, or venue name drift
- Re-sort by start time

### 7. Deploy
Deploy `generate-itinerary` edge function.

## Technical Details

- **Locked flag**: `locked: true` + `lockedSource: string` on activity objects (not a schema change — these are JSONB fields within `itinerary_data`)
- **Time parsing**: Handles "9AM", "9:00AM", "9AM-11:30AM" formats via regex
- **Category detection**: Title-keyword-based (breakfast → dining, museum → explore, meeting → activity, etc.)
- **Gap detection**: Compares locked time slots to find open windows for AI to fill
- **Merge strategy**: Locked cards take priority; AI activities overlapping locked time slots are discarded with `[LOCKED-SKIP]` logging

## What's NOT Changed
- Chat-trip-planner's `perDayActivities` extraction (Prompt 82)
- `mustDoActivities` fallback for non-structured inputs
- Single City / Multi-City / Build Myself flows
- Database schema
- Transit calculation or duration logic

