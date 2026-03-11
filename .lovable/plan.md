

## Fix 22G: Expand Data Structures + Pass-Through Context

### Overview
Add missing data fields to `CompilerInput` and `SerializerContext`, update `determineDayType` for preference fallbacks, add synthetic flight handling in `constraint-filler.ts`, wire 6 new prompt sections, and update the feature flag branch in `index.ts`. Then sync `src/` copies.

### Files to Edit (4 edge function files + 3 src copies)

**1. `supabase/functions/generate-itinerary/schema/compile-day-schema.ts`**
- Add 10 new optional fields to `CompilerInput` (userConstraints, generationRules, additionalNotes, interestCategories, mustHaves, isFirstTimeVisitor, previousDayActivities, preferredArrivalTime/DepartureTime, preBookedCommitments, pacingOverride)
- Update `determineDayType` to fall back to `preferredArrivalTime`/`preferredDepartureTime` when flight data is missing, with midday_arrival as default for day 1

**2. `supabase/functions/generate-itinerary/schema/constraint-filler.ts`**
- At the top of `fillFlightAndHotelSlots`, build synthetic arrival/departure objects from `preferredArrivalTime`/`preferredDepartureTime` when no flight record exists (day 1 / last day only)
- Synthetic flights use generic "Airport" name and empty code

**3. `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts`**
- Add 6 new optional fields to `SerializerContext`: `userConstraintsText`, `visitorGuidance`, `tripPurpose`, `interestWeighting`, `mustHavesText`, `skipList`
- Add 6 conditional sections in `buildSystemPrompt` after the archetype-specific instructions block (USER CONSTRAINTS, VISITOR CONTEXT, TRIP PURPOSE, INTEREST PREFERENCES, TRIP MUST-HAVES, DO NOT REPEAT)

**4. `supabase/functions/generate-itinerary/index.ts`** (lines ~7993-8007)
- Replace the placeholder log in the `USE_SCHEMA_GENERATION` block with actual wiring:
  - Build `compilerInput` from existing `context.*` variables (destination, dayNumber, totalDays, travelerDNA, flight/hotel data, mustDos, userConstraints, additionalNotes, interestCategories, mustHaves, isFirstTimeVisitor, previousDayActivities, preferences, preBookedCommitments, pace)
  - Build `serializerContext` mapping existing prompt variables to the new fields (archetypeContext, destinationEssentialsPrompt, budgetConstraints, visitor guidance text, skip list from previousDayActivities, etc.)
  - Call `compileDaySchema` → `serializeSchemaToPrompt` → assign to `finalSystemPrompt`/`finalUserPrompt`

**5-7. Sync `src/` copies:**
- `src/lib/schema-compiler/compile-day-schema.ts` — same CompilerInput expansion + determineDayType update
- `src/lib/schema-compiler/constraint-filler.ts` — same synthetic flight logic
- `src/lib/schema-compiler/schema-to-prompt.ts` — same SerializerContext expansion + new prompt sections

### Key Variable Mappings (from existing index.ts code)
- `context.userConstraints` → `compilerInput.userConstraints` (stringified)
- `context.generationRules` → `compilerInput.generationRules`
- `context.additionalNotes` → `compilerInput.additionalNotes`
- `context.interestCategories` → `compilerInput.interestCategories`
- `context.mustHaves` → `compilerInput.mustHaves` (mapped to string[])
- `isFirstTimeVisitor` (already resolved per-city at line 1582) → `compilerInput.isFirstTimeVisitor`
- `previousDayActivities` (accumulated in day loop) → `compilerInput.previousDayActivities`
- `context.pace` → `compilerInput.pacingOverride`
- `context.preBookedCommitments` → `compilerInput.preBookedCommitments`

### What does NOT change
- Feature flag stays `false`
- No existing generation logic modified
- No UI changes

