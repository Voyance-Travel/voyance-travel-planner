

## Fix 23L: Flexible Schema Prompt + Post-AI Safety Nets

### Summary

Rewrite the AI prompt from rigid slot-filling mandate to flexible concierge guidance, add post-AI meal deduplication, and expand sanitization patterns. Also fix the misplaced chronological sort from the previous Fix 23L implementation.

### Files Changed: 5

**File 1: `supabase/functions/generate-itinerary/schema/schema-to-prompt.ts`**
**File 2: `src/lib/schema-compiler/schema-to-prompt.ts`**
(Both get identical changes to `buildSystemPrompt`, `buildUserPrompt`, and `serializeSlot`)

1. **Replace ROLE AND VOICE** (Section 1): Change from "CRITICAL: You do NOT decide the day's structure" to flexible concierge framing — "Here is a SUGGESTED structure... apply common sense... CONFIRMED items must be preserved."

2. **Replace SLOT FILLING RULES** (Section 5): Replace rigid 8-rule mandate with "HOW TO USE THIS STRUCTURE" — explains CONFIRMED vs SUGGESTED, preserves output format requirements, adds COMMON SENSE RULES (one meal per period, meals in meal slots, geographic logic, buffer time, chronological order) and COMMON SENSE EXAMPLES (early arrival + must-do → skip hotel, all-day event → eat at venue, etc.). Group trip `suggestedFor` requirement moves here.

3. **Replace `serializeSlot()`**: Change from `SLOT 0: [ARRIVAL] — FILLED / LOCKED — DO NOT MODIFY` to numbered list with `[CONFIRMED]` and `[SUGGESTED]` labels. Remove `⚠ [SYSTEM-INSTRUCTION]` text that AI was echoing. Use lowercase type labels instead of UPPERCASE.

4. **Replace `buildUserPrompt()`**: Change from "Fill this schema" + "Return EXACTLY the same number" to "Plan Day N" + "Return ALL activities in chronological order" with flexible framing.

**File 3: `supabase/functions/generate-itinerary/index.ts`**

5. **Add meal deduplication step** (after buffer enforcement at line 8925, before ENRICH step at line 8927): One meal per window (breakfast <11:00, lunch 11:00-16:00, dinner >16:00). Also removes back-to-back dining. Only removes unlocked, non-must-do activities. Wrapped in try/catch.

6. **Add final chronological sort** (immediately after meal dedup): Simple `parseTimeToMinutes` sort as the very last ordering step.

7. **Remove misplaced chronological sort** (lines 6415-6475): The previous Fix 23L placed this block in the wrong location (after auth check in generate-day, not after buffer enforcement). Remove it — the new sort at step 6 replaces it correctly.

**File 4: `supabase/functions/generate-itinerary/sanitization.ts`**

8. **Add broader sanitization patterns** (inside `SYSTEM_ANNOTATION_PATTERNS`): Add patterns for "fill this slot", "find a morning activity", `[CONFIRMED]`, `[SUGGESTED]` tag leaks, and "this is your/the traveler's dedicated/special" variants.

**File 5: `src/utils/textSanitizer.ts`**

9. **Mirror the same new patterns** in the client-side sanitizer.

### What Does NOT Change
- Schema compiler, skeleton system, confirmed item handling
- Tool schema / JSON response format
- AI model or calling mechanism
- Generation chain, retry logic, poller
- Frontend code (beyond sanitizer)
- must-do-filler.ts (already fixed in 23M)

