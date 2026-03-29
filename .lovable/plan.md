

## Phase 2: Extract `generate-day` Handler to Action File

### Current State

The `generate-day`/`regenerate-day` handler spans **lines 7815–12248** (~4,433 lines) in `index.ts`. The previous blocker (inline utility functions) is **already resolved** — all utilities used by this handler are imported from extracted modules (`flight-hotel-context.ts`, `day-validation.ts`, `sanitization.ts`, etc.).

### What This Handler Uses

**Imported modules** (already extracted — no work needed):
- `parseTimeToMinutes`, `minutesToHHMM`, `addMinutesToHHMM`, `normalizeTo24h` from `flight-hotel-context.ts`
- `validateGeneratedDay`, `filterChainRestaurants`, `enforceRequiredMealsFinalGuard`, `detectMealSlots` from `day-validation.ts`
- `sanitizeGeneratedDay`, `stripPhantomHotelActivities`, `sanitizeAITextField` from `sanitization.ts`
- `parseMustDoInput`, `validateMustDosInItinerary` from `must-do-priorities.ts`
- `deriveMealPolicy`, `buildMealRequirementsPrompt` from `meal-policy.ts`
- All prompt-building, truth-anchor, dietary, geographic modules — already imported at top of index.ts

**Inline dependencies** (defined earlier in index.ts, must be extracted or shared):
- Types: `GenerationContext`, `StrictActivity`, `StrictDay`, `MultiCityDayInfo`, `EnrichmentStats`, `TripOverview`
- Functions: `prepareContext`, `enrichActivity`, `enrichItinerary`, `generateTripOverview`, `finalSaveItinerary`, `calculateDays`, `formatDate`, `timeToMinutes`, `calculateDuration`, `getCategoryIcon`, `normalizeVenueName`, `checkVenueCache`, `cacheVerifiedVenue`, `verifyVenueWithDualAI`, `verifyVenueWithGooglePlaces`, `haversineDistanceKm`, `getDestinationCenter`, `isBookableActivity`, `searchViatorForActivity`, `enrichActivityWithRetry`
- Also: `validateAuth`, `checkRateLimit`, `verifyTripAccess`, `corsHeaders`

### Plan

**Step 1: Create `generation-types.ts`** — Extract shared types/interfaces
- Move `GenerationContext`, `StrictActivity`, `StrictDay`, `MultiCityDayInfo`, `TripOverview`, `TravelAdvisory`, `LocalEventInfo`, `EnrichedItinerary`, `ValidationContext` from index.ts into this new shared file
- Both `index.ts` and the new action file import from here

**Step 2: Create `generation-utils.ts`** — Extract shared utility functions
- Move `calculateDays`, `formatDate`, `timeToMinutes`, `calculateDuration`, `getCategoryIcon`, `normalizeVenueName` 
- These are pure functions with zero dependencies — safe to extract

**Step 3: Create `action-generate-day.ts`** — Move the handler
- Move lines 7815–12248 from `index.ts`
- Export `handleGenerateDay(supabase: any, userId: string, params: Record<string, any>): Promise<Response>`
- Import types from `generation-types.ts`, utils from `generation-utils.ts`, and all existing extracted modules
- The handler needs `corsHeaders`, `verifyTripAccess`, `LOVABLE_API_KEY`, `supabaseUrl`, `supabaseKey`, `GOOGLE_MAPS_API_KEY` — pass these via params or import from `action-types.ts`
- Venue enrichment functions (`enrichActivity`, `verifyVenueWithDualAI`, etc.) stay in index.ts for now since `generate-full` also uses them. They'll move in Phase 3.

**Step 4: Update `index.ts` routing**
- Import `handleGenerateDay` from `action-generate-day.ts`
- Replace the 4,433-line inline block with:
```typescript
if (action === 'generate-day' || action === 'regenerate-day') {
  return handleGenerateDay(supabase, authResult.userId, params);
}
```

**Step 5: Update `plan.md`** — Mark Phase 2 as done

### Impact
- `index.ts` drops from ~12,322 to ~7,900 lines
- `generate-day` becomes independently readable and testable
- No functional changes — identical behavior, just code location moves

### Risk Mitigation
- The handler's auth check (userId mismatch, trip access verification) moves with it — no security gap
- All module imports are path-relative within the same `generate-itinerary/` directory — no import resolution issues
- Edge function deployment bundles the entire directory, so new files are automatically included

