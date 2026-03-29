

## Phase 2, Step 3: Extract generate-day Handler — Safe Plan

### What We're Moving

The `generate-day`/`regenerate-day` handler block: **lines 6677–11110** (~4,433 lines) from `index.ts` into a new `action-generate-day.ts`.

### Pre-Move: Fix Scoping Issues

**`triggerNextJourneyLeg` (lines 6730–6824)** is defined INSIDE the generate-day block but called by `finalSaveItinerary` (line 3460) which is in the generate-full pipeline. This is a scoping bug — it works via function hoisting but is logically in the wrong place.

- Move `triggerNextJourneyLeg` OUT of the generate-day block and into a shared location (keep it in `index.ts` above `finalSaveItinerary`, or put it in `generation-utils.ts`)
- It is NOT called by generate-day itself — only by generate-full's `finalSaveItinerary`

### Shared Dependencies (Stay in index.ts)

These inline functions are used by BOTH generate-full and generate-day — they stay in `index.ts`:

| Function | Lines | Used By |
|---|---|---|
| `validateItineraryPersonalization` | 355–578 | generate-full (5705), generate-day (10087) |
| `buildValidationContext` | 583–613 | generate-full (5698), generate-day (10072) |
| `corsHeaders` | 340–345 | Everything |
| `verifyTripAccess` | 3747–3798 | generate-full, generate-day (6701) |
| `validateAuth` | 3719–3735 | Main routing |
| `checkRateLimit` | 649–663 | Main routing |
| `STRICT_ITINERARY_TOOL` | 669–832 | DEAD CODE (unused) — can delete |

**Resolution**: Export `validateItineraryPersonalization`, `buildValidationContext`, `corsHeaders`, and `verifyTripAccess` so the new action file can import them. Two options:
1. Move them to `generation-utils.ts` or `action-types.ts` (cleanest)
2. Keep in `index.ts` and re-export (quick but less clean)

**Recommended**: Move `validateItineraryPersonalization` + `buildValidationContext` into `generation-types.ts` (they use types already defined there). `corsHeaders` and `verifyTripAccess` are already duplicated in `action-types.ts` — use those imports.

### The Extraction

**New file: `action-generate-day.ts`**
- Export `handleGenerateDay(supabase, userId, params): Promise<Response>`
- Contains all logic from lines 6677–11110 (minus triggerNextJourneyLeg)
- Imports from existing modules: `sanitization.ts`, `day-validation.ts`, `meal-policy.ts`, `prompt-library.ts`, `truth-anchors.ts`, `geographic-coherence.ts`, `personalization-enforcer.ts`, `flight-hotel-context.ts`, `preference-context.ts`, `venue-enrichment.ts`, `generation-types.ts`, `generation-utils.ts`, etc.
- Reads env vars directly via `Deno.env.get()` (same pattern as current code)
- Imports `corsHeaders` from `action-types.ts`
- Imports `verifyTripAccess` from `action-types.ts`
- Imports `validateItineraryPersonalization`, `buildValidationContext` from `generation-types.ts`

**Updated `index.ts`**
- Replace 4,433-line block with:
```typescript
if (action === 'generate-day' || action === 'regenerate-day') {
  return handleGenerateDay(supabase, authResult.userId, params);
}
```
- Move `triggerNextJourneyLeg` to just above `finalSaveItinerary` (where it's actually called)
- Delete `STRICT_ITINERARY_TOOL` (dead code, 163 lines)
- Result: index.ts drops from ~11,184 to ~6,600 lines

### Execution Steps

1. Move `validateItineraryPersonalization` + `buildValidationContext` into `generation-types.ts`
2. Move `triggerNextJourneyLeg` up in `index.ts` (above `finalSaveItinerary`)
3. Delete `STRICT_ITINERARY_TOOL` dead code
4. Create `action-generate-day.ts` with the handler block
5. Update `index.ts` routing to delegate
6. Update `index.ts` imports (add import for `handleGenerateDay`)
7. Run smoke tests to verify all 17 pass

### Risk Assessment

- **Zero logic changes** — pure code relocation
- `triggerNextJourneyLeg` move is fixing a pre-existing scoping smell
- All module imports are relative within the same directory
- Smoke tests cover both `generate-day` and `regenerate-day` actions
- `generate-full` continues working — its shared deps stay accessible

