

## Phase 2: Extract `generate-day` Handler to Action File

### Status: Steps 1-2 DONE, Step 3 IN PROGRESS

### Completed

**Step 1: Created `venue-enrichment.ts`** ✅
- Extracted: `checkVenueCache`, `cacheVerifiedVenue`, `getDestinationCenter`, `verifyVenueWithGooglePlaces`, `verifyVenueWithDualAI`, `fetchActivityImage`, `isBookableActivity`, `searchViatorForActivity`, `enrichActivity`, `enrichActivityWithRetry`, `enrichItinerary`
- Module-level `destinationCenterCache` singleton
- Imports shared types from `generation-types.ts` and utils from `generation-utils.ts`

**Step 2: Updated shared modules + index.ts imports** ✅
- `generation-utils.ts` now includes: `getDestinationId`, `getAirportTransferMinutes`, `getAirportTransferFare`
- `generation-types.ts` already had all types from prior step
- `index.ts` now imports from both new modules instead of defining inline
- Inline type definitions (MultiCityDayInfo, GenerationContext, StrictActivity, StrictDay, etc.) removed from index.ts
- Inline functions (calculateDays, formatDate, etc.) removed from index.ts
- Venue enrichment block (~840 lines) removed from index.ts
- **Result: index.ts reduced from 12,322 → 11,184 lines (-1,138 lines)**
- **All 17 smoke tests pass** ✅

### Remaining

**Step 3: Move generate-day handler into `action-generate-day.ts`**
- Move lines ~7600–12030 (the `if (action === 'generate-day' || action === 'regenerate-day')` block)
- Move `triggerNextJourneyLeg` (defined inside the handler block)
- Export `handleGenerateDay(supabase, userId, params)`
- Update index.ts routing to delegate
- Expected reduction: index.ts → ~5,800 lines

**Step 4: Update plan.md** — Mark Phase 2 as done

### Risk Notes
- The `validateItineraryPersonalization` and `buildValidationContext` functions remain inline in index.ts — they're used by both generate-full and generate-day. Moving them to a shared module is optional (they could go to generation-types.ts or a new validation.ts).
