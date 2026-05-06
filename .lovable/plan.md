## Bug

The Fine-Tune trait sliders (Adventure, Planning/Spontaneity, Authenticity, etc. in `TraitOverrideSliders.tsx`) write to `profiles.travel_dna_overrides`, but the itinerary generator never reads that column. The prompt is built from `travel_dna_profiles.trait_scores` (with a fallback to the legacy `profiles.travel_dna` blob) — overrides are silently ignored.

Evidence:
- `supabase/functions/generate-itinerary/preference-context.ts:178` defines `getTraitOverrides()` reading `profiles.travel_dna_overrides`.
- A repo-wide grep (`rg "getTraitOverrides|trait_overrides|traitOverrides" supabase/`) shows that function has **zero call sites**.
- `profile-loader.ts:266` resolves `traitScores` only from the DNA profile / blob, then `prompt-library.ts:1744` walks those scores to render the trait narrative — overrides never enter the pipeline.

So a user who pushes Adventure to +9 still gets the prompt their base quiz produced.

## Fix

Single change: merge `profiles.travel_dna_overrides` into `traitScores` inside the profile loader, then verify it lands in the prompt. No UI changes (the slider already persists correctly).

### 1. Wire overrides into the profile loader

In `supabase/functions/generate-itinerary/profile-loader.ts`, after STEP 5 (trait-score resolution, around line 289):

- Fetch overrides via the existing `getTraitOverrides(supabase, userId)` (move/import it, or inline the same `select('travel_dna_overrides')` query).
- For each numeric value present in overrides, replace the corresponding `traitScores[key]`.
  - The slider stores values on the `-10..+10` scale (same as `TraitScores`); guard with `Number.isFinite` and clamp to `[-10, 10]`.
- Append to `warnings` an info line `Trait overrides applied: <keys>` and `console.log` the before/after diff for traceability.
- Increment `dataCompleteness` by 5 when at least one override is applied (overrides are an explicit signal of intent).

### 2. Make the override visible to the prompt

`compile-prompt.ts` and `prompt-library.ts:1744` already read `profile.traitScores`, so once the loader merges overrides, the trait-narrative block, archetype-tone hints, and adventure/authenticity copy automatically reflect the slider. No prompt edits needed — verify by logging the merged `traitScores` once at the top of `compile-prompt.ts` (gated behind the existing debug flag).

### 3. Source-of-truth tag in the ledger / metadata

Add `traitOverridesApplied: string[]` to the existing trip metadata snapshot written in `action-save-itinerary.ts` (whichever object already records `archetypeSource`). This lets us tell post-hoc whether a degenerate output came from a user who *did* tune the sliders.

### 4. Regression test

New `supabase/functions/generate-itinerary/profile-loader.test.ts` (or extend an existing test if present):

- Mock `travel_dna_profiles` returning `{ trait_scores: { adventure: 0, authenticity: 0, planning: 5 } }`.
- Mock `profiles` returning `{ travel_dna_overrides: { adventure: 9, planning: -7 } }`.
- Assert the returned `traitScores.adventure === 9`, `planning === -7`, `authenticity === 0`.
- Assert warnings include the override-applied note.

### 5. Memory note

Add a short memory entry: *"Fine-Tune trait sliders (`profiles.travel_dna_overrides`) are merged on top of `travel_dna_profiles.trait_scores` inside `profile-loader`. Don't reintroduce a path that reads trait_scores without the override merge."*

## Files

**Edited**
- `supabase/functions/generate-itinerary/profile-loader.ts` — merge overrides into `traitScores`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — record `traitOverridesApplied` in trip metadata
- `mem://index.md` + new `mem://features/itinerary/trait-overrides-merge`

**Created**
- `supabase/functions/generate-itinerary/profile-loader.test.ts` (or new test in the existing file)

**Untouched**
- `TraitOverrideSliders.tsx` — already persists correctly
- `prompt-library.ts` / `compile-prompt.ts` — already consume `profile.traitScores`; merge happens upstream

No schema changes. Pure server-side wiring + test.