## Pairing Coherence for Secondary Archetype Selection

Update `src/services/engines/travelDNA/archetype-matcher.ts` so the secondary archetype is chosen with a same-category penalty and a forbidden-pair filter, instead of always being the second-highest raw score.

### Change

Replace the two-line primary/secondary selection (around lines 413–414):

```ts
const primary = matches[0];
const secondary = matches.length > 1 && matches[1].score > 0 ? matches[1] : null;
```

With:

1. `primary = matches[0]` (unchanged).
2. Build `secondaryCandidates` from `matches.slice(1)`, computing `adjustedScore = m.category === primary.category ? m.score * 0.7 : m.score` (30% same-category penalty).
3. Re-sort candidates by `adjustedScore` desc.
4. Define a module-level `FORBIDDEN_PAIRS` set with the 14 incoherent slug pairs from the spec, and an `isForbiddenPair(a, b)` helper that checks both orderings.
5. `secondary = secondaryCandidates.find(m => !isForbiddenPair(primary.id, m.id) && m.adjustedScore > 0) ?? null`.

### Notes

- `FORBIDDEN_PAIRS` will be defined at module scope (above the function) so it isn't re-allocated each call. `isForbiddenPair` will live alongside it.
- No changes to scoring, gates, or the confidence-gap logic above this block.
- `ArchetypeMatch` already carries `category` and `id`, so no type changes needed.

### Verification

- `grep -c "FORBIDDEN_PAIRS" src/services/engines/travelDNA/archetype-matcher.ts` ≥ 1.
- Synthetic test 1: Sanctuary Seeker primary + Adrenaline Architect close-second → secondary is filtered out (forbidden), next eligible candidate returned.
- Synthetic test 2: Two Restorer-category matches close in score → 0.7× penalty pushes a different-category candidate into secondary slot unless gap is very large.
