


## Phase 4: Clean Up `index.ts` — Remove Dead Imports & Duplicates

### Status: DONE ✅

### Completed
- Removed ~340 lines of unused imports (generation-types, generation-utils, venue-enrichment, sanitization, currency-utils, budget-constraints, personalization-enforcer, truth-anchors, explainability, geographic-coherence, prompt-library, meal-policy, dietary-rules, trip-duration-rules, reservation-urgency, jet-lag-calculator, weather-backup, daily-estimates, group-archetype-blending, pre-booked-commitments, must-do-priorities, packing-suggestions, archetype-data, trip-type-modifiers, profile-loader, destination-essentials, user-context-normalization, flight-hotel-context, preference-context)
- Removed duplicate `corsHeaders` definition — now imported from `action-types.ts`
- Removed duplicate `verifyTripAccess` function — already in `action-types.ts`
- Removed all stale "moved to X" placeholder comments
- Fixed buggy catch block that referenced out-of-scope `params`/`supabase` variables
- Consolidated CRUD action dispatch to share a single `ActionContext` instance
- **Result: `index.ts` reduced from 743 → 183 lines (75% reduction)**

## Phase 3: Extract `generate-full` Pipeline

### Status: DONE ✅

### Completed

**Step 1: Extracted shared generation infrastructure into `generation-core.ts`** ✅
- Moved: `prepareContext`, `generateSingleDayWithRetry`, `generateItineraryAI`, `earlySaveItinerary`, `generateTripOverview`, `triggerNextJourneyLeg`, `finalSaveItinerary`
- ~2,919 lines of shared infrastructure with all necessary imports
- All functions exported for use by both `action-generate-full.ts` and potentially `action-generate-day.ts`

**Step 2: Extracted `generate-full` handler into `action-generate-full.ts`** ✅
- Moved the complete 7-stage pipeline (~2,783 lines) into `handleGenerateFull(supabase, userId, params, authHeader)`
- Fixed bugs: bare `destination` → `context.destination` (4 occurrences), `dayCity_56?.destination` → `dayCity_56?.cityName`
- Added `authHeader` parameter to pass auth context for internal edge function calls (hidden gems discovery)

**Step 3: Updated `index.ts` routing** ✅
- Added import: `import { handleGenerateFull } from './action-generate-full.ts'`
- Replaced ~2,783-line block with:
  ```typescript
  if (action === 'generate-full') {
    const authHeaderValue = req.headers.get('Authorization') || '';
    return handleGenerateFull(supabase, authResult.userId, params, authHeaderValue);
  }
  ```

### Final Metrics

| File | Before | After |
|---|---|---|
| `index.ts` | 6,431 lines | ~743 lines |
| `generation-core.ts` | — | ~2,919 lines |
| `action-generate-full.ts` | — | ~2,783 lines |

### Cumulative Metrics (Phase 1 → Phase 3)

| File | Original | Final |
|---|---|---|
| `index.ts` | ~12,322 lines | ~743 lines (94% reduction) |
| Extracted modules | 0 | 4 action files + 2 shared modules |

## Phase 2: Extract `generate-day` Handler to Action File

### Status: DONE ✅

### Completed

**Step 1: Created `venue-enrichment.ts`** ✅
- Extracted: `checkVenueCache`, `cacheVerifiedVenue`, `getDestinationCenter`, `verifyVenueWithGooglePlaces`, `verifyVenueWithDualAI`, `fetchActivityImage`, `isBookableActivity`, `searchViatorForActivity`, `enrichActivity`, `enrichActivityWithRetry`, `enrichItinerary`
- Module-level `destinationCenterCache` singleton
- Imports shared types from `generation-types.ts` and utils from `generation-utils.ts`

**Step 2: Updated shared modules + index.ts imports** ✅
- `generation-utils.ts` now includes: `getDestinationId`, `getAirportTransferMinutes`, `getAirportTransferFare`
- `generation-types.ts` already had all types from prior step
- `index.ts` now imports from both new modules instead of defining inline
- **Result: index.ts reduced from 12,322 → 11,184 lines (-1,138 lines)**
- **All 17 smoke tests pass** ✅

**Step 3: Extracted generate-day handler into `action-generate-day.ts`** ✅
- Moved `validateItineraryPersonalization` + `buildValidationContext` into `generation-types.ts` (shared by both paths)
- Moved `triggerNextJourneyLeg` above `finalSaveItinerary` in index.ts (scoping fix)
- Deleted `STRICT_ITINERARY_TOOL` dead code (~164 lines)
- Created `action-generate-day.ts` (4,579 lines) with `handleGenerateDay(supabase, userId, params)`
- Fixed `body.date` → `params.date`, `supabaseClient` → `supabase`, `effectiveHotelData` → `flightContext` references
- Updated index.ts routing to delegate:
  ```typescript
  if (action === 'generate-day' || action === 'regenerate-day') {
    return handleGenerateDay(supabase, authResult.userId, params);
  }
  ```
- **Result: index.ts reduced from 11,184 → 6,431 lines (-4,753 lines)**
