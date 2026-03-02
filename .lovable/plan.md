

## Fix: Secondary archetype lost after disambiguation/fine-tune adjustment

### Root Cause

After answering a disambiguation question (or fine-tuning), `recalculateDNAFromPreferences` is called, which:
1. Converts stored preferences to quiz-like answers via `preferencesToQuizAnswers`
2. Re-runs `determineArchetype(flatAnswers)` with these preference-derived answers
3. These preference-derived answers lack the full quiz signal (life-stage questions, emotional questions, etc.), so the archetype matcher often returns the same archetype for both primary and secondary positions
4. This gets saved to the database (e.g., `primary_archetype_name: midlife_explorer`, `secondary_archetype_name: midlife_explorer`)
5. The UI correctly filters out the secondary when it matches the primary (line 490 of `TravelDNAReveal.tsx`), so nothing displays

Confirmed in the database: the user's profile has both `primary_archetype_name` and `secondary_archetype_name` set to `midlife_explorer`.

### Fix

**File: `src/utils/quizMapping.ts`** (in `recalculateDNAFromPreferences`, around lines 1235-1263)

Two changes:

1. **Preserve existing secondary when recalc produces a duplicate**: After re-matching archetypes, if the new secondary is the same as the primary, fall back to the previously stored secondary (fetched from the database before recalc). This prevents the recalc from clobbering a valid secondary with a duplicate.

2. **Fetch existing DNA before recalc to preserve secondary**: At the start of `recalculateDNAFromPreferences`, also fetch the current `travel_dna_profiles` row so we have the original `secondary_archetype_name` to fall back to.

Specific logic change in the archetype re-match block:
```
// Current (broken):
const secondaryId = archetypeResult.secondary?.id || dna.secondary_archetype_name || null;

// Fixed:
const candidateSecondary = archetypeResult.secondary?.id || dna.secondary_archetype_name || null;
const secondaryId = (candidateSecondary && candidateSecondary !== primaryId)
  ? candidateSecondary
  : existingDna?.secondary_archetype_name || null;  // fall back to pre-recalc secondary
```

Where `existingDna` is fetched at the top of the function from `travel_dna_profiles`.

3. **Same fix for the quiz completion recalc path** (around line 940-960 in `saveQuizResultsToDatabase`): Apply the same deduplication guard there too, for consistency.

### Technical Details

- **Files to modify**: `src/utils/quizMapping.ts`
- **Changes**:
  - Add a `getTravelDNA(userId)` call at the start of `recalculateDNAFromPreferences` to capture the existing secondary before it gets overwritten
  - In the archetype re-match block (line ~1247), add a check: if the resolved secondary matches the primary, use the pre-existing secondary instead, or `null` if there was none
  - Apply the same guard in `saveQuizResultsToDatabase` if the same pattern exists there
- **No database migration needed** -- this is purely a frontend recalculation logic fix
- **No new dependencies**

