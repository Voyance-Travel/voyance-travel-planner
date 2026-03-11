

## Fix 22I: Pre-Booked Commitments Slot Filling

### Overview
Create `prebooked-filler.ts` in the edge function schema directory to fill confirmed reservations/shows/tours into schema slots. Integrate as Step 5c in the compiler. Sync to `src/`.

### Files to Create (2)

**1. `supabase/functions/generate-itinerary/schema/prebooked-filler.ts`**
- Edge function copy header
- `PreBookedInput` interface, `isDiningCommitment()`, `inferMealType()`, `fillPreBookedSlots()` as specified
- Dining commitments replace matching meal slots; non-dining fill activity slots with reverse-scheduled transport
- Imports from `./types.ts`, `./time-parser.ts`, `./feature-flags.ts`

**2. `src/lib/schema-compiler/prebooked-filler.ts`**
- Same logic, imports from `@/types/schema-generation`, `./time-parser`, `@/config/feature-flags`

### Files to Update (4)

**1. `supabase/functions/generate-itinerary/schema/compile-day-schema.ts`**
- Add import: `import { fillPreBookedSlots } from './prebooked-filler.ts';`
- After must-do filling (line 128), add Step 5c:
  ```typescript
  if (input.preBookedCommitments && input.preBookedCommitments.length > 0) {
    filledSlots = fillPreBookedSlots(filledSlots, input.preBookedCommitments, input.hotel?.address);
  }
  ```

**2. `supabase/functions/generate-itinerary/schema/index.ts`**
- Add exports: `fillPreBookedSlots`, `PreBookedInput`

**3. `src/lib/schema-compiler/compile-day-schema.ts`**
- Same integration as edge function copy

**4. `src/lib/schema-compiler/index.ts`**
- Add matching exports

### What does NOT change
- Feature flag stays `false`
- No existing generation logic modified
- No UI changes

