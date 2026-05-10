## Goal

When the matcher returns Purpose Voyager (slug `community_builder`) and Passport Collector (slug `collection_curator`) as the top two archetypes with a close score gap, ask a tailored disambiguation question instead of a generic trait-based one.

## Files & changes

### 1. `supabase/functions/calculate-travel-dna/index.ts`

**A. Add pair-specific question map** (just below `DISAMBIGUATION_QUESTIONS_BY_TRAIT`, ~line 1103):

```ts
// TODO: archetype slug `community_builder` displays as "Purpose Voyager" —
// confusion source. Consider unifying in a future schema migration.
const DISAMBIGUATION_QUESTIONS_BY_PAIR: Record<string, string[]> = {
  'community_builder:collection_curator': ['purpose_vs_collection'],
  'collection_curator:community_builder': ['purpose_vs_collection'],
};
```

**B. Pair-first selection** in the disambiguation block (~line 2521, before the trait-based loop):

```ts
const pairKey = `${primaryArchetype.id}:${secondaryArchetype?.id ?? ''}`;
const reversedKey = `${secondaryArchetype?.id ?? ''}:${primaryArchetype.id}`;
const pairQuestions =
  DISAMBIGUATION_QUESTIONS_BY_PAIR[pairKey] ??
  DISAMBIGUATION_QUESTIONS_BY_PAIR[reversedKey];

if (pairQuestions && pairQuestions.length > 0) {
  // Filter against answered + valid IDs the same way the trait branch does
  const filtered = pairQuestions.filter(
    (q) => !answeredQuestionIds.has(q),
  );
  if (filtered.length > 0) {
    nextQuestionIds = filtered.slice(0, 3);
    console.log(`[TravelDNA V2] Pair-specific disambiguation:`, pairKey, nextQuestionIds);
  }
}

// Existing trait-based fallback only runs when nextQuestionIds is still unset
if (!nextQuestionIds && disambiguationTraits && disambiguationTraits.length > 0) {
  // ... existing logic unchanged ...
}
```

Note: `purpose_vs_collection` is **not** a quiz ID — it's a MicroDisambiguation question ID. Skip the `VALID_QUIZ_QUESTION_IDS` check for pair questions (they're served by the modal, not the quiz).

### 2. `src/components/profile/MicroDisambiguation.tsx`

Append a new entry to the `DISAMBIGUATION_QUESTIONS` array (~line 149), matching the existing schema (`question`/`label`/`iconName`, deltas keyed to the 8 traits):

```ts
{
  id: 'purpose_vs_collection',
  question: 'When you get back from a trip, what matters more?',
  subtext: 'Helps us tell apart two close-fitting archetypes.',
  options: [
    {
      id: 'recommend_authority',
      label: 'Being able to recommend the best spots to everyone who asks',
      iconName: 'Users',
      // Purpose Voyager (community_builder) leans social + transformation
      deltas: { social: 4, transformation: 3 },
    },
    {
      id: 'check_off_destination',
      label: 'Crossing another destination off your personal list',
      iconName: 'MapPin',
      // Passport Collector (collection_curator) leans adventure + low transformation
      deltas: { adventure: 3, transformation: -2 },
    },
  ],
},
```

Trait mapping rationale (since spec deltas `experience_accumulation`, `social_sharing`, `collection_drive`, `bucket_list` aren't in the 8-trait system):
- `recommend_authority` → `social:+4` (sharing/authority is social) + `transformation:+3` (purpose-driven travel)
- `check_off_destination` → `adventure:+3` (novelty/quantity of places) + `transformation:-2` (away from purpose)

## Verification

- `grep -c "DISAMBIGUATION_QUESTIONS_BY_PAIR" supabase/functions/calculate-travel-dna/index.ts` ≥ 2
- `grep -n "purpose_vs_collection" src/components/profile/MicroDisambiguation.tsx` returns 1 hit
- Profile that scores `community_builder` primary + `collection_curator` close-second: edge function logs `[TravelDNA V2] Pair-specific disambiguation: community_builder:collection_curator`
- Modal shows the new question (not pace/social/etc. trait questions)
- Answering "recommend authority" → re-recalculation tilts toward Purpose Voyager; "check off destination" tilts toward Passport Collector

## Out of scope

- Renaming the `community_builder` slug to `purpose_voyager` (separate large migration).
- Adding more pair-specific questions for other archetype pairs.
