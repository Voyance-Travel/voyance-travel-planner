

## Fix 22K: Keep Activities / Regeneration Support

### Overview
Create `keep-activities-filler.ts` to pre-fill kept activities as locked slots during regeneration. Integrate as Step 5d in the compiler. Sync to `src/`.

### Files to Create (2)

**1. `supabase/functions/generate-itinerary/schema/keep-activities-filler.ts`**
- Edge function copy with Deno imports from `./types.ts` and `./time-parser.ts`
- `KeptActivity` interface, `fillKeptActivities()` function, `findInsertionPoint()` helper
- Matches dining kept activities to meal slots, others to activity slots
- Inserts new locked slots if no match found; re-indexes positions

**2. `src/lib/schema-compiler/keep-activities-filler.ts`**
- Same logic, imports from `@/types/schema-generation` and `./time-parser`

### Files to Update (4)

**1. `supabase/functions/generate-itinerary/schema/compile-day-schema.ts`**
- Add `keepActivities` field to `CompilerInput` (after `destinationHotel`, line 119)
- Add import: `import { fillKeptActivities } from './keep-activities-filler.ts';`
- After Step 5c (line 150), add Step 5d: `if (input.keepActivities?.length > 0) { filledSlots = fillKeptActivities(filledSlots, input.keepActivities); }`

**2. `src/lib/schema-compiler/compile-day-schema.ts`**
- Same: add `keepActivities` to `CompilerInput`, import, Step 5d integration

**3. `supabase/functions/generate-itinerary/schema/index.ts`**
- Add: `export { fillKeptActivities } from './keep-activities-filler.ts';`
- Add: `export type { KeptActivity } from './keep-activities-filler.ts';`

**4. `src/lib/schema-compiler/index.ts`**
- Same exports

### What does NOT change
- Feature flag stays `false`
- No existing generation logic modified
- No UI changes

