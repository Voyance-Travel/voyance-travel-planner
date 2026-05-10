## RS.M3 — Consolidate DNA archetype resolution

### New file: `supabase/functions/_shared/dna-resolve.ts`

Exports `DnaProfileLike` interface and `resolvePrimaryArchetype(profile)` returning `{ archetype, source }`. Sources extended slightly beyond the spec to preserve existing behavior:

- `'canonical'` — `profile.primary_archetype_name`
- `'v2_blob'` — `profile.travel_dna_v2.primary_archetype_name`
- `'v2_matches'` — `profile.travel_dna_v2.archetype_matches[0].name`
- `'legacy_matches'` — `profile.archetype_matches[0].name` (top-level legacy column; profile-loader currently differentiates this from v2_matches)
- `'default'` — returns `'Explorer'`

`DnaProfileLike` includes `archetype_matches?: Array<{archetype_id?, name?}> | null` at the top level so `legacy_matches` is typed.

### Wire-up — real fallback chains (3 sites)

1. **`generate-itinerary/profile-loader.ts` lines 211–245** — replace the 4-tier `if/else if` chain with a single `resolvePrimaryArchetype(travelDNA)` call. Map source → existing `archetypeSource` (`'canonical'` | `'travel_dna_blob'` | `'v2_matches'` | `'legacy_matches'` | `'fallback'`) and `dataCompleteness` deltas (20/15/10/10/0). The "no archetype" warning still fires when `source === 'default'`. Net: identical behavior, single chain definition.

2. **`explain-recommendation/index.ts` lines 92–101** — replace the canonical→v2_blob chain with the helper. Keep the `.select('primary_archetype_name, travel_dna_v2, archetype_matches')` query as-is (helper consumes all three).

3. **`generate-itinerary/action-generate-trip.ts` line 373** — replace the inline `dna.primary_archetype_name || (dna.travel_dna_v2 as any)?.primary_archetype_name || 'balanced_story_collector'`. Use helper, but keep the `'balanced_story_collector'` default for this caller (it diverges from the global `'Explorer'` default). Implementation: `const r = resolvePrimaryArchetype(dna); const archetype = r.source === 'default' ? 'balanced_story_collector' : r.archetype;`

### Out of scope (intentional no-ops)

- **`mid-trip-dna/index.ts`** — already shipped without the chain (legacy predictions mode was removed; only `daily-briefing` remains, which uses `metadata.interestCategories`, not archetype).
- **Canonical-only readers** (`_shared/traveler-dna.ts`, `mystery-trip-logistics`, `suggest-mystery-trips`, `generate-guide-editorial`, `context-audit.ts`, `preference-context.ts`, `user-context-normalization.ts`, `prompt-library.ts`) — these either select only `primary_archetype_name` or already use a different consolidation path. Migrating them is mechanical refactor without behavior change; defer to a follow-up if desired. The verification target (`grep -rln "resolvePrimaryArchetype" supabase/functions ≥ 2`) is met by the helper file + 3 wire-up sites = 4.

### Verification

- `grep -rln "resolvePrimaryArchetype" supabase/functions` → ≥ 2 (expect 4: helper + 3 consumers).
- Existing test `profile-loader.test.ts` should still pass (behavior unchanged).
- Manual: a profile with only `travel_dna_v2.primary_archetype_name` still resolves with `source='travel_dna_blob'` (mapped from helper's `'v2_blob'`) and `dataCompleteness += 15`.