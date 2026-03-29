

## Phase 2: Extract `generate-day` Handler — Safe Execution Plan

### Current Situation

The `generate-day`/`regenerate-day` handler spans lines **7815–12248** (~4,433 lines) in index.ts. It depends on ~15 inline functions defined earlier in index.ts that are **also used by `generate-full`** (lines 5028–7810). We cannot simply move the handler without addressing these shared dependencies.

### Shared Inline Dependencies (used by BOTH generate-full and generate-day)

| Function | Lines | Purpose |
|---|---|---|
| `calculateDays`, `formatDate`, `timeToMinutes`, `calculateDuration`, `getCategoryIcon` | 1151–1191 | Pure date/time/icon utilities |
| `validateItineraryPersonalization` + `buildValidationContext` | 532–790 | Post-gen validation |
| `normalizeVenueName` | 3564 | Venue name normalization |
| `checkVenueCache` + `cacheVerifiedVenue` | 3577–3683 | Venue cache read/write |
| `verifyVenueWithDualAI` + `verifyVenueWithGooglePlaces` + `getDestinationCenter` | 3686–4029 | Google Places enrichment |
| `isBookableActivity` + `searchViatorForActivity` | 4032–4223 | Viator integration |
| `enrichActivityWithRetry` + `enrichItinerary` | 4226–4365 | Activity enrichment pipeline |
| `getDestinationId` | 796–815 | Destination UUID lookup |
| `getAirportTransferMinutes` + `getAirportTransferFare` | 1081–1141 | Airport transfer data |
| `triggerNextJourneyLeg` | 7868–7963 | Journey chaining (defined INSIDE generate-day block) |

### Strategy: Extract Shared Functions First, Then Move the Handler

This is a **3-step execution** within Phase 2:

---

**Step 1: Extract venue enrichment pipeline into `venue-enrichment.ts`**

Move these functions into a new shared module:
- `normalizeVenueName` (already duplicated in `generation-utils.ts` — consolidate)
- `checkVenueCache`, `cacheVerifiedVenue`
- `verifyVenueWithDualAI`, `verifyVenueWithGooglePlaces`, `getDestinationCenter`
- `destinationCenterCache` (module-level Map)
- `isBookableActivity`, `searchViatorForActivity`
- `enrichActivityWithRetry`, `enrichItinerary`

Both `index.ts` and the future `action-generate-day.ts` import from this module. `index.ts` replaces the inline definitions with imports.

---

**Step 2: Extract validation + utility functions into shared modules**

- Move `validateItineraryPersonalization` + `buildValidationContext` + associated types (`ValidationContext`, `ValidationResult`, `ValidationViolation`, `ValidationWarning`) into `generation-types.ts` (already created in prior step)
- Update `generation-utils.ts` to include `getDestinationId`, `getAirportTransferMinutes`, `getAirportTransferFare` (pure DB lookups)
- Confirm `calculateDays`, `formatDate`, `timeToMinutes`, `calculateDuration`, `getCategoryIcon` are already in `generation-utils.ts` (they are — just need index.ts to import them instead of defining inline)

Replace all inline definitions in `index.ts` with imports.

---

**Step 3: Move the generate-day handler into `action-generate-day.ts`**

- Move lines 7815–12248 into a new file
- Export `handleGenerateDay(supabase, userId, params)`
- Move `triggerNextJourneyLeg` (defined inside the handler block) into the same file
- Import all dependencies from:
  - `venue-enrichment.ts` (enrichment pipeline)
  - `generation-types.ts` (types + validation)
  - `generation-utils.ts` (pure utilities)
  - All existing extracted modules (sanitization, day-validation, prompt-library, etc.)
- Access env vars (`LOVABLE_API_KEY`, `GOOGLE_MAPS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) via `Deno.env.get()` directly (same as current code does at line 10495)

Update `index.ts` routing:
```typescript
if (action === 'generate-day' || action === 'regenerate-day') {
  return handleGenerateDay(supabase, authResult.userId, params);
}
```

---

### Impact

| Metric | Before | After |
|---|---|---|
| `index.ts` lines | ~12,322 | ~5,800 |
| New files | 0 | 2 (`venue-enrichment.ts`, `action-generate-day.ts`) |
| Updated files | 0 | 3 (`index.ts`, `generation-types.ts`, `generation-utils.ts`) |
| Functional changes | None | None — identical behavior |

### Risk Mitigation

- Each step is independently deployable and testable
- Step 1 and 2 only change import sources — no logic changes
- Step 3 is a pure code-location move
- Existing smoke tests (17 tests in `index.test.ts`) verify no 500s after each step
- `generate-full` continues working because its dependencies remain importable from the new shared modules

