

# Quiz Archetype Reachability Audit

## Summary of Findings

After a thorough review of the 21-question quiz (quiz-questions-v3.json), the archetype matcher algorithm, and the display layer, there are **two categories of problems**:

---

## Problem 1: Missing Archetype Profiles (4 archetypes unreachable)

The Archetypes display page lists 29 archetypes across 6 categories, but the quiz scoring config only defines profiles for 24 of them (plus BSC as default). These 4 archetypes **cannot be assigned by the quiz because they have no scoring profile**:

| Archetype | Category | Status |
|-----------|----------|--------|
| `story_seeker` | CONNECTOR | No profile in quiz config |
| `sanctuary_seeker` | RESTORER | No profile in quiz config |
| `escape_artist` | RESTORER | No profile in quiz config |
| `curated_luxe` | CURATOR | No profile in quiz config |

Additionally, `flexible_wanderer` exists in the quiz config but is **not listed** in the Archetypes.tsx display categories (EXPLORER only shows 4, missing flexible_wanderer).

So the actual count is: **24 scorable profiles + 1 default (BSC) + 4 missing = 29 displayed**. The BSC never wins in normal scoring (score = -Infinity), making it effectively 24 reachable archetypes.

---

## Problem 2: Single-Path and Narrow-Gate Archetypes

Several archetypes have hard gates on traits that only 1-2 quiz answers can satisfy. They're technically reachable but fragile:

| Archetype | Hard Gate | Quiz Answers That Satisfy |
|-----------|-----------|--------------------------|
| **Healing Journeyer** | `healing_focus >= 0.7` | Only q18e (0.9) |
| **Art Aficionado** | `art_focus >= 0.7` | Only q7a (0.9) |
| **Collection Curator** | `niche_interest >= 0.7` | Only q7d (0.9) |
| **Digital Explorer** | `photo_focus >= 0.7` | Only q7c (0.9) |
| **Status Seeker** | `status_seeking >= 0.7` | Only q13c (0.85) + q3d (0.7) |
| **Urban Nomad** | `nature_orientation <= 0.25` | Only q16b (0.1); any nature answer kills it |
| **Beach Therapist** | `nature 0.4-0.6` AND `pace <= 0.4` AND `restoration >= 0.6` | Very narrow corridor |
| **Romantic Curator** | `romance_focus >= 0.7` | Only q17b (0.9) |
| **Family Architect** | `family_focus >= 0.7` | Only q17d (0.9) |
| **Slow Traveler** | `pace <= 0.35` | Must consistently pick slow options |

These are reachable but live on a knife's edge — one "wrong" answer elsewhere can disqualify them via penalties or dilution.

---

## Problem 3: BSC (Balanced Story Collector) Is Dead

BSC is marked `isDefault: true` which forces `score: -Infinity` in the matcher. The code says "BSC only wins if there are literally NO scored archetypes" — but that can never happen since all other profiles always get scored. BSC is effectively unreachable.

---

## Recommended Fix Plan

### Phase 1: Add Missing Archetype Profiles
Add scoring profiles to `quiz-questions-v3.json` for the 4 missing archetypes:

1. **`story_seeker`** (CONNECTOR) — required: `cultural_depth >= 0.5`, `social_energy >= 0.4`, `novelty_seeking >= 0.5`. Boosters: cultural_depth, social_energy, learning_focus.

2. **`sanctuary_seeker`** (RESTORER) — required: `restoration_need >= 0.7`, `quality_intrinsic >= 0.5`. Boosters: restoration_need, quality_intrinsic, nature_orientation. Differentiates from retreat_regular by emphasizing quality/comfort over planning.

3. **`escape_artist`** (RESTORER) — required: `restoration_need >= 0.5`, `novelty_seeking >= 0.5`. Boosters: restoration_need, novelty_seeking, flexibility. The "I need to get away" archetype.

4. **`curated_luxe`** (CURATOR) — required: `quality_intrinsic >= 0.6`, `planning >= 0.5`, `budget_tier >= 0.5`. Boosters: quality_intrinsic, planning, food_focus. Differentiates from luxury_luminary by emphasizing curation/planning.

### Phase 2: Add `flexible_wanderer` to Display
Add `flexible_wanderer` to the EXPLORER category in `Archetypes.tsx` (and corresponding narrative/detail data if missing).

### Phase 3: Widen Trait Coverage for Narrow Archetypes
Add secondary trait signals to more quiz answers so single-path archetypes have 2-3 paths instead of 1. For example:
- Add `art_focus: 0.3-0.4` to answers about cultural depth or museum mentions
- Add `healing_focus: 0.3` to the rest/restoration answers (q11b, q18c)
- Add `niche_interest: 0.3` to the planning-heavy answers
- Add `photo_focus: 0.3` to novelty-seeking or adventure answers

### Phase 4: Fix BSC Handling
Either remove BSC from the 29 count (it's a fallback, not a real archetype) or give it a real scoring profile so it can win for genuinely balanced users (all traits near 0.5).

---

## Technical Details

**Files to modify:**
- `src/config/quiz-questions-v3.json` — add 4 archetype profiles, widen trait signals on answers
- `src/pages/Archetypes.tsx` — add `flexible_wanderer` to EXPLORER category
- `src/data/archetypeNarratives.ts` — add narrative data for any missing archetypes
- `src/data/archetypeDetailContent.ts` — add detail content for any missing archetypes

**Algorithm is sound** — the weighted-max scoring (70% max / 30% avg), hard gates, boosters, penalties, and life stage bonuses are well-designed. The issue is purely **content coverage**: not enough quiz answers touch the niche traits, and 4 profiles are simply missing.

No database changes needed. No edge function changes. This is purely frontend config + content.

