## Context

The pairing coherence rules described in the request are **already implemented** in `src/services/engines/travelDNA/archetype-matcher.ts`:

- 30% same-category penalty for secondary candidates (lines 461–466)
- `FORBIDDEN_PAIRS` Set + `isForbiddenPair()` helper (lines 17–36)
- Forbidden-pair filter on secondary selection (lines 468–470)

However, two entries in the existing `FORBIDDEN_PAIRS` Set use a stale archetype ID `purpose_voyager` that does not exist anywhere else in the codebase. The canonical ID (used in `archetype-profiles.ts`, `quizMapping.ts`, `archetype-group-mapping.ts`, narratives, reveals, voices, constraints, etc.) is `community_builder` (display name: "The Purpose Voyager"). As written, those two forbidden pairs never trigger because the matcher emits `community_builder`, not `purpose_voyager`.

## Change

In `src/services/engines/travelDNA/archetype-matcher.ts`, inside the `FORBIDDEN_PAIRS` Set:

- Line 21: `'sanctuary_seeker:purpose_voyager'` → `'sanctuary_seeker:community_builder'`
- Line 26: `'slow_traveler:purpose_voyager'` → `'slow_traveler:community_builder'`

No other edits — the rest of the spec (penalty logic, helper, filter, full pair list) already matches the requested implementation exactly.

## Verification

- `grep -c FORBIDDEN_PAIRS src/services/engines/travelDNA/archetype-matcher.ts` ≥ 1 (currently 2)
- `rg purpose_voyager src/ supabase/` returns no hits after the fix
- 14 forbidden pairs total, all using canonical IDs from `archetype-profiles.ts`
- Sanctuary Seeker × Adrenaline Architect pairing test: secondary falls through to next candidate (already works)
- Slow Traveler × Sanctuary Seeker (both Restorer): secondary picks non-Restorer due to 30% penalty unless gap is large (already works)
