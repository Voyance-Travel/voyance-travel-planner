

## Phase 2, Step 3: Extract generate-day Handler — Implementation Plan

### Summary
Move the `generate-day`/`regenerate-day` handler (lines 6677–11110, ~4,433 lines) from `index.ts` into `action-generate-day.ts`. Fix shared dependency issues first, then extract.

### Pre-Move Fixes (in index.ts)

1. **Move `triggerNextJourneyLeg` out of the generate-day block** (lines 6726–6824)
   - It's defined inside generate-day but called by `finalSaveItinerary` at line 3460
   - Move it to just above `finalSaveItinerary` (around line 3400) so both generate-full and generate-day can access it
   - The copy in `action-save-itinerary.ts` and `action-generate-trip-day.ts` already exists — index.ts just needs its own accessible copy

2. **Move `validateItineraryPersonalization` + `buildValidationContext` to `generation-types.ts`**
   - Lines 355–613 in index.ts → append to generation-types.ts
   - Both generate-full (line 5705) and generate-day (line 10087) use them
   - They depend on `checkDietaryViolations` and `isRecurringEvent` — add those as imports to generation-types.ts
   - Update index.ts to import from generation-types.ts instead

3. **Delete `STRICT_ITINERARY_TOOL`** (lines 669–832) — dead code, never referenced

### The Extraction

4. **Create `action-generate-day.ts`**
   - Export `handleGenerateDay(supabase: any, userId: string, params: Record<string, any>): Promise<Response>`
   - Contains all logic from lines 6677–11110 (minus triggerNextJourneyLeg which stays in index.ts)
   - Fix `body.date` references (lines 7309, 7313) → use `params.date` instead
   - Imports from existing extracted modules:
     - `corsHeaders`, `verifyTripAccess` from `./action-types.ts`
     - Types from `./generation-types.ts`
     - Utils from `./generation-utils.ts`
     - `enrichActivityWithRetry`, `enrichItinerary` from `./venue-enrichment.ts`
     - `sanitizeGeneratedDay`, etc. from `./sanitization.ts`
     - `validateGeneratedDay`, `StrictDayMinimal`, etc. from `./day-validation.ts`
     - `deriveMealPolicy`, etc. from `./meal-policy.ts`
     - `buildDayPrompt`, etc. from `./prompt-library.ts`
     - `getFlightHotelContext`, etc. from `./flight-hotel-context.ts`
     - `getUserPreferences`, `getLearnedPreferences`, `buildPreferenceContext` from `./preference-context.ts`
     - All other modules (truth-anchors, geographic-coherence, personalization-enforcer, etc.)
   - Env vars read via `Deno.env.get()` directly (same pattern as existing code)

5. **Update `index.ts` routing**
   - Add import: `import { handleGenerateDay } from './action-generate-day.ts'`
   - Replace the 4,433-line block with:
```typescript
if (action === 'generate-day' || action === 'regenerate-day') {
  return handleGenerateDay(supabase, authResult.userId, params);
}
```

6. **Update `.lovable/plan.md`** — mark Phase 2 Step 3 as done

### Technical Details

- **`body.date` fix**: The handler references `body.date` at lines 7309/7313 inside a closure. Since `body = { action, ...params }`, `body.date === params.date`. Replace with `params.date`.
- **Import graph**: The new file imports ~20 modules, all already extracted and path-relative within `generate-itinerary/`.
- **`GenerationTimer`**: Already imported at top of index.ts from `./generation-timer.ts` — add same import in new file.
- **`loadTravelerProfile`**: Imported from `./profile-loader.ts` — add in new file.

### Impact

| Metric | Before | After |
|---|---|---|
| `index.ts` lines | ~11,184 | ~6,400 |
| New files | 0 | 1 (`action-generate-day.ts`) |
| Updated files | 0 | 3 (`index.ts`, `generation-types.ts`, `.lovable/plan.md`) |
| Functional changes | None | None |

### Risk Mitigation
- Pure code relocation — no logic changes
- `body.date` → `params.date` is a safe substitution (same value)
- All 17 smoke tests verify no 500s after extraction
- `generate-full` keeps working because shared deps are now importable from `generation-types.ts`

