# Fix: Secondary DNA being wiped by auto-recalc

## Root cause (confirmed)
`recalculateArchetype()` re-runs the pure-TS `matchArchetypes` on every page visit (via `<DNARecalcOnVisit />`) and after every `saveTravelDNA()`. For some trait profiles the TS matcher gate-fails, picks a different primary, and writes `secondary = null` — overwriting the authoritative result from the `calculate-travel-dna` edge function. `travel_dna_history` proves the affected users (incl. `b7868fe8…`) previously had a valid secondary (`midlife_explorer`) that got clobbered.

## Changes

### 1. Stop the clobber (code)
- `src/utils/quizMapping.ts` — remove the unconditional `recalculateArchetype(userId)` call inside `saveTravelDNA()` (~L897-906).
- Remove `<DNARecalcOnVisit />` from the app shell (likely `src/App.tsx` or layout) so it no longer auto-runs on visit.
- Keep `recalculateArchetype.ts` file intact for explicit, user-initiated recalc paths (e.g. Fine-Tune sliders via `recalculateUserDNA`).
- The edge function `calculate-travel-dna` remains the authoritative writer to `travel_dna_profiles`.

### 2. Restore 4 clobbered users (data migration)
For each `travel_dna_profiles` row where `secondary_archetype_name IS NULL AND primary_archetype_name IS NOT NULL`, look up the most recent `travel_dna_history` snapshot for that user where `secondary_archetype_name IS NOT NULL`, and restore `primary_archetype_name`, `secondary_archetype_name`, and `dna_confidence_score` from it.

### 3. Update memory rule
Rewrite `mem://constraints/dna/storage-merge-and-recalc`:
- Edge function `calculate-travel-dna` is the authoritative writer.
- TS `matchArchetypes` is a UI/preview helper only — MUST NOT auto-write on save or on visit.
- Explicit user-initiated recalc (Fine-Tune sliders) is still allowed.

## Verification
1. `b7868fe8…` row shows `secondary = midlife_explorer` after migration.
2. Profile hero card renders `STORYTELLER | … | hints of Midlife Explorer`.
3. Hard-reload `/profile` → secondary still present (no clobber).
4. 0 rows remain with `primary NOT NULL AND secondary NULL AND trait_scores NOT NULL`.

## Out of scope
No matcher logic, UI, or quiz/conversation write-path changes.