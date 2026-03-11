

## Fix 22J: Multi-City / Transition Day Support

### Overview
Add `transition` day type with its own skeleton, update `determineDayType` to detect transition days, fill transition-specific slots in the constraint filler, and add a transition note to the user prompt. Sync all changes to `src/` copies.

### Files to Update (8 total: 4 edge function + 4 src)

**1. `supabase/functions/generate-itinerary/schema/types.ts`** (line 25)
- Add `| 'transition'` to `DayType`

**2. `src/types/schema-generation.ts`** (line 22)
- Same: add `| 'transition'` to `DayType`

**3. `supabase/functions/generate-itinerary/schema/compile-day-schema.ts`**
- Add 7 new fields to `CompilerInput`: `isMultiCity`, `isTransitionDay`, `transitionFrom`, `transitionTo`, `transitionMode`, `transitionDepartureTime`, `transitionArrivalTime`, `destinationHotel`
- Update `determineDayType`: check `isTransitionDay` FIRST (before departure/arrival checks), return `'transition'`

**4. `src/lib/schema-compiler/compile-day-schema.ts`**
- Same CompilerInput expansion + determineDayType update

**5. `supabase/functions/generate-itinerary/schema/day-skeletons.ts`**
- Add `case 'transition': return buildTransitionDaySkeleton();` to switch
- Add `buildTransitionDaySkeleton()` function with 10 slots: breakfast → checkout → optional origin activity → transport to hub → inter-city transit → transport to hotel → check-in → optional destination activity → dinner → optional evening

**6. `src/lib/schema-compiler/day-skeletons.ts`**
- Same skeleton addition

**7. `supabase/functions/generate-itinerary/schema/constraint-filler.ts`**
- Add transition day handling at end of `fillFlightAndHotelSlots`:
  - Fill inter-city transport slot with transition mode/times
  - Fill destination hotel check-in from `destinationHotel`
  - Replace ORIGIN/DESTINATION placeholders in aiInstructions
  - Remove origin morning activity if transit departs before noon
  - Remove evening slots if transit arrives after 8pm

**8. `src/lib/schema-compiler/constraint-filler.ts`**
- Same transition handling

**9. `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts`** (line 229)
- In `buildUserPrompt`, after the first line, add transition day note when `schema.dayType === 'transition'`

**10. `src/lib/schema-compiler/schema-to-prompt.ts`** (line 257)
- Same transition note

### What does NOT change
- Feature flag stays `false`
- No existing generation logic modified
- No UI changes
- `index.ts` exports unchanged (no new modules created)

