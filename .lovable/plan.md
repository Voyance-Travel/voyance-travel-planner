

## Fix: Wildcard Card Not Opening Detail Sheet

**Root Cause**: `flexible_wanderer` is missing from the `NARRATIVE_TO_DETAIL` mapping in `src/pages/Archetypes.tsx` (line 20-49). When clicked, `handleSelectArchetype` looks up the mapping, gets `undefined`, and the detail sheet never opens.

**Fix** (one line addition in `src/pages/Archetypes.tsx`):

Add `flexible_wanderer: 'wanderer'` to the `NARRATIVE_TO_DETAIL` map. The `wanderer` detail entry already exists in `archetypeDetailContent.ts` and is a perfect match for The Wildcard archetype.

