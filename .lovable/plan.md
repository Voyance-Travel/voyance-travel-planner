
## Context

Gate definitions are not in `archetype-matcher.ts` itself — they live in `src/config/quiz-questions-v3.json` under `archetypeProfiles`, and the matcher reads them via `archetypeProfiles[id]`. Reviewing each archetype against the spec, **most gates already match** (likely from the earlier matcher rebuild). Only one archetype needs a real edit; the rest are already in spec.

## Per-archetype reconciliation

| Archetype (slug) | Spec change | Current state | Action |
|---|---|---|---|
| `community_builder` (Purpose Voyager) | category=achiever, requiredAny experience_accumulation≥0.6 OR bucket_list≥0.6, social_sharing 0.4 booster, drop ethics_focus/cultural_depth gate | category=ACHIEVER, requiredAny exactly as spec'd, social_sharing:0.4 already booster, no ethics_focus/cultural_depth gate | ✅ no change needed |
| `collection_curator` (Passport Collector) | required collection_drive≥0.6 + novelty_seeking≥0.5; bucket_list 0.5 booster; niche_interest soft-only | matches exactly (niche_interest 0.4 booster, not required) | ✅ no change needed |
| `escape_artist` | category=explorer, required autonomy_preference≥0.7, drop restoration_need gate | category=EXPLORER, only autonomy_preference≥0.7 required, no restoration_need gate | ✅ no change needed |
| `retreat_regular` | required escape_need≥0.6 + restoration_need≥0.6 + wellness boosters | matches exactly | ✅ no change needed |
| `wilderness_pioneer` | required nature_orientation≥0.7, adventure≥0.5; -1.0 penalty for high city/urban | gates match; "urban" encoded as `nature_orientation below 0.5 weight -1.0` (trait is "Urban 0 → Wilderness 1") | ✅ no change needed |
| `adrenaline_architect` | required adventure≥0.7, pace≥0.6, no nature gate | matches exactly | ✅ no change needed |
| `healing_journeyer` | healing_focus≥0.6 (lowered from 0.7); restoration_need 0.5 booster | required healing_focus:0.6, restoration_need:0.5 booster | ✅ no change needed |
| `cultural_anthropologist` | cultural_depth≥0.7, learning_focus 0.5–0.7 cap, -1.5 penalty above 0.8 | matches exactly | ✅ no change needed |
| `sabbatical_scholar` | learning_focus≥0.7, cultural_depth≥0.5, planning≥0.4 | matches exactly | ✅ no change needed |

## The single edit

**`community_builder` boosters trim** — spec lists only `social_sharing: 0.4` as the secondary booster. Current config also keeps `social_energy: 0.6` and `learning_focus: 0.5` as boosters. Spec says "Keep existing booster scoring untouched UNLESS specifically noted" — and the secondary-booster section *is* a specific note for this archetype. To make Purpose Voyager identity-focused (experience accumulation + sharing) and stop bleeding into Sabbatical Scholar / Social Butterfly territory:

- Remove `social_energy: 0.6` and `learning_focus: 0.5` from `community_builder.boosters`
- Keep `experience_accumulation: 1.0`, `bucket_list: 0.8`, `social_sharing: 0.4`

This is the only behavioral delta in the spec that isn't already in the config.

## Verification

1. Reload quiz config; build/typecheck (no TS shape change — JSON only).
2. Synthetic profile A: `experience_accumulation=0.7, social_sharing=0.5` → `community_builder` primary.
3. Synthetic profile B: `collection_drive=0.7, novelty_seeking=0.6` → `collection_curator` primary.
4. Synthetic profile C: `autonomy_preference=0.8, pace=0.7` → `escape_artist` primary, category EXPLORER.
5. Synthetic profile D: `escape_need=0.7, restoration_need=0.7` → `retreat_regular` primary.
6. Spot-check that the existing `dna_recalc_needed_at` flag still triggers `recalculateIfNeeded` on next visit so live users converge on the trimmed boosters.

## Files touched

- `src/config/quiz-questions-v3.json` — single 3-line edit inside `archetypeProfiles.community_builder.boosters`.

No changes to `archetype-matcher.ts`, `recalculateArchetype.ts`, or any frontend component.
