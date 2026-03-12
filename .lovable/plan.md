

## Fix 23L: Post-Processing Safety Net — Sort, Apply Corrections, Enforce Logical Order

### Changes

**File 1: `supabase/functions/generate-itinerary/index.ts`**

1. **Apply schema validator corrections** (lines 8564-8569): Replace the "log but don't override" block with logic that iterates `validationResult.correctedActivities` and applies overrides (title, time, cost, suggestedFor) back onto `generatedDay.activities` by matching on title/startTime.

2. **Add chronological sort + transport→venue enforcement** (after line 8842, before the ENRICH step at line 8844): Insert a new post-processing step wrapped in try/catch that:
   - Sorts `normalizedActivities` by `parseTimeToMinutes(startTime)`
   - Detects transport activities (via regex + category check) whose destination venue appears earlier in the list
   - Fixes venue startTime to equal transport endTime, recalculates venue endTime preserving duration
   - Re-sorts after fixes
   - Uses `parseTimeToMinutes` and `minutesToHHMM` (already imported from `flight-hotel-context.ts`)

**File 2: `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts`** (edge function copy)

3. **Reword must-do instruction** (line 279): Change `'⚠ This is the traveler\'s must-do activity. Preserve exactly.'` to `'⚠ [SYSTEM-INSTRUCTION] This is the traveler\'s must-do. Preserve the title, time, and location exactly as given.'`

**File 3: `src/lib/schema-compiler/schema-to-prompt.ts`** (source of truth)

4. **Same reword** (line 310): Identical change to keep both copies in sync.

### Files Changed: 3
- `supabase/functions/generate-itinerary/index.ts` — Apply validator corrections, chronological sort, transport→venue fix
- `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts` — Reword must-do prompt marker
- `src/lib/schema-compiler/schema-to-prompt.ts` — Same reword (source of truth)

