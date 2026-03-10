

## Plan: Merge `curated_luxe` into `status_seeker`

Remove `curated_luxe` as a standalone archetype everywhere and add legacy remaps so existing users are treated as `status_seeker`.

### Files & Changes

**1. `supabase/functions/calculate-travel-dna/index.ts`** (4 changes)
- **Delete** the `curated_luxe` object from `ARCHETYPES_V2` array (lines 573-583)
- **Legacy answer mapping** (line 863): Keep the `curated_luxe` key in `LEGACY_ANSWER_MAPPINGS` — it's used for quiz answer scoring, not archetype identity. Rename is not needed since it maps trait deltas.
- **QUESTION_MAPPINGS** (line 932): Keep `curated_luxe` answer mapping — this handles users who selected "curated_luxe" as their traveler type in quiz v1. The deltas still apply correctly.
- **commonCombos** (line 1846): Change `['luxury_luminary', 'curated_luxe']` to `['luxury_luminary', 'status_seeker']`
- **assertBudgetPolarity** (line 2257): This tests answer-level budget polarity, not archetype identity — keep as-is since `curated_luxe` is a valid answer value
- **Add legacy migration** near the top of the handler: remap `primary_archetype_name` / `secondary_archetype_name` from `curated_luxe` → `status_seeker`

**2. `supabase/functions/generate-itinerary/archetype-constraints.ts`** (1 change)
- In `getArchetypeDefinition` (line 1558): Add `if (normalized === 'curated_luxe') normalized = 'status_seeker';` before the lookup

**3. `src/pages/Archetypes.tsx`** (2 changes)
- Remove `curated_luxe` from `CURATOR` category array (line 60)
- Remove `curated_luxe: 'luxurian'` from category mappings (line 49)

**4. `src/pages/HowItWorks.tsx`** (1 change)
- Remove `'curated_luxe'` from archetype carousel list (line 56)

**5. `src/utils/quizMapping.ts`** (5 changes)
- Remove legacy remap `'curated_luxe': 'luxury_luminary'` (line 177)
- Remove `curated_luxe` from `getArchetypeDisplayName` (line 637)
- Remove `curated_luxe` from `getArchetypeCategory` (line 684)
- Remove `curated_luxe` from taglines (line 728)
- Remove `curated_luxe` from vibes (line 752)

**6. `src/utils/quizContent.ts`** (1 change)
- Remove `curatedLuxe` from `travelerTypeLabels` (lines 17-20) — but this is a quiz answer label (what users see when selecting traveler type), not an archetype display. Will remap to reference status_seeker's style or remove if no longer a quiz answer option.

**7. `src/data/archetypeNarratives.ts`** (1 change)
- Delete entire `curated_luxe` narrative object (lines 416-440)

**8. `src/config/typeRarity.ts`** (1 change)
- Delete `curated_luxe` entry (lines 168-172)

**9. `src/config/quiz-questions-v3.json`** (1 change)
- Delete the `curated_luxe` archetype definition object (lines 1837-1856)

### What stays
- `LEGACY_ANSWER_MAPPINGS.curated_luxe` and its usage in `QUESTION_MAPPINGS.traveler_type` — these handle quiz v1 answer scoring (trait deltas), not archetype identity
- `assertBudgetPolarity('curated_luxe', ...)` — tests answer-level budget direction
- The legacy remap lines in `archetype-constraints.ts` and `calculate-travel-dna/index.ts`

