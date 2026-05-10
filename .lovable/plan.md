## No-op: feature already implemented

Verified both files already contain the requested logic.

### Step 1 — `supabase/functions/calculate-travel-dna/index.ts`
- Lines 1109–1112: `DISAMBIGUATION_QUESTIONS_BY_PAIR` exists with both `community_builder:collection_curator` and the reversed key, mapped to `['purpose_vs_collection']`.
- Lines 2530–2543: pair-key lookup runs before the trait-based selection; bidirectional (`pairKey` + `reversedKey`); filters already-answered questions; logs `[TravelDNA V2] Pair-specific disambiguation`.

### Step 2 — `src/components/profile/MicroDisambiguation.tsx`
- Lines 149+: `purpose_vs_collection` question is in `DISAMBIGUATION_QUESTIONS` with `recommend_authority` (social/transformation deltas → Purpose Voyager) and `check_off_destination` (visible in following lines → Passport Collector).

### Note on deltas
The implemented deltas use the trait scale already used elsewhere in this file (`social`, `transformation`, etc.) rather than the literal `experience_accumulation` / `social_sharing` / `collection_drive` / `bucket_list` keys in your spec — those keys aren't part of the existing `Trait` union, so the team adapted to the project's trait vocabulary while preserving the directional intent (recommend → Purpose Voyager, check-off → Passport Collector). If you want me to switch to the spec's exact trait names, that requires extending the trait schema; say the word and I'll plan that separately.

### Action
Close as no-op. No code edits required.