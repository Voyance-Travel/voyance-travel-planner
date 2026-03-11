

## Fix 22H: Pacing Override

### Overview
Create `pacing-override.ts` in the edge function schema directory, integrate it as Step 4b in `compile-day-schema.ts`, update `index.ts` exports, then sync to `src/`.

### Files to Create (2)

**1. `supabase/functions/generate-itinerary/schema/pacing-override.ts`**
- As specified in the prompt: `PACING_LIMITS` config, `applyPacingOverride()` function
- Caps/floors activity and evening slot counts per pacing level
- Adds free time block for "relaxed", adds activity slots for "packed"
- Re-indexes positions after mutations

**2. `src/lib/schema-compiler/pacing-override.ts`**
- Same logic, imports from `@/types/schema-generation` instead of `./types.ts`

### Files to Update (4)

**1. `supabase/functions/generate-itinerary/schema/compile-day-schema.ts`** (lines 19-23, 109-110)
- Add import: `import { applyPacingOverride } from './pacing-override.ts';`
- After line 109 (`applyDnaModifiers`), add Step 4b: apply pacing override if `input.pacingOverride` is set, then pass `pacedSlots` to `fillFlightAndHotelSlots`

**2. `supabase/functions/generate-itinerary/schema/index.ts`** (after line 18)
- Add: `export { applyPacingOverride } from './pacing-override.ts';`
- Add: `export type { PacingLevel } from './pacing-override.ts';`

**3. `src/lib/schema-compiler/compile-day-schema.ts`**
- Same integration: import `applyPacingOverride`, add Step 4b

**4. `src/lib/schema-compiler/index.ts`**
- Add matching exports

### What does NOT change
- Feature flag stays `false`
- No existing generation logic modified
- No UI changes

