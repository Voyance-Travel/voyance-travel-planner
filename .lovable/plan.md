

## Fix 23M: Sanitize AI Prompt Echo — Strip Leaked System Instructions from Output

### Changes

**File 1: `supabase/functions/generate-itinerary/sanitization.ts`**

1. **Add broader regex patterns** (after line 76, inside `SYSTEM_ANNOTATION_PATTERNS` array): Add 8 new patterns to catch fragmented/paraphrased AI echoes of prompt instructions — covers "Preserve exactly" variants, `[SYSTEM-INSTRUCTION]` markers, broader "MUST END" patterns without requiring the exact dash+trailing phrase, departure constraint fragments, and leading `&` artifacts.

2. **Description dedup** (line 137): After sanitizing `act.description`, add a check that compares normalized description to normalized title — if near-identical (same or title+<15 chars), clear the description.

3. **Tips dedup** (line 138): Same pattern — if sanitized tip just restates the title (includes title and <30 chars longer), clear it.

**File 2: `src/utils/textSanitizer.ts`**

4. **Mirror the same new patterns** (after line 33, inside `SYSTEM_ANNOTATION_PATTERNS`): Add the same 8 patterns so client-side sanitization also catches these echoes.

**File 3: `supabase/functions/generate-itinerary/schema/must-do-filler.ts`**

5. **Stop injecting constraint text into notes** (lines 241-252): Replace the block that writes "MUST END before..." into `slot.filledData.notes` with one that stores the constraint on `slot.departureConstraint` instead, keeping notes clean for user-facing output.

**File 4: `src/lib/schema-compiler/must-do-filler.ts`**

6. **Same change** (lines 298-310): Mirror the must-do-filler fix in the source-of-truth copy.

### Files Changed: 4
- `supabase/functions/generate-itinerary/sanitization.ts` — Broader patterns + description/tip dedup
- `src/utils/textSanitizer.ts` — Mirror broader patterns
- `supabase/functions/generate-itinerary/schema/must-do-filler.ts` — Move constraint out of notes
- `src/lib/schema-compiler/must-do-filler.ts` — Same (source of truth)

