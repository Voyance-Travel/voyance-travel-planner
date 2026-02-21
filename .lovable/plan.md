

# Fix: Resolve 4 Remaining Archetype Tie-Breakers (85% to 100%)

## Overview
All 4 remaining failures are marginal scoring overlaps (0-3.8 point gaps), not systemic bugs. Each needs a targeted config tweak in `src/config/quiz-questions-v3.json`.

## Fix 1: Adrenaline Architect vs Bucket List Conqueror (exact tie at 75.1)

**Problem**: Both score identically on a high-adventure profile because their booster weights produce the same total.

**Fix**: Add `morning_energy` as a booster (0.6) to Adrenaline Architect. Early alpine starts and dawn surf sessions are core to this archetype but irrelevant to bucket-list checking. This breaks the tie without changing any other archetype's score.

```text
adrenaline_architect.boosters:
  adventure: 1.5
  pace: 1.0
  nature_orientation: 0.6
+ morning_energy: 0.6        <-- new differentiator
```

## Fix 2: Slow Traveler vs Flexible Wanderer (65.0 vs 68.8)

**Problem**: Both pass each other's gates. Flexible Wanderer wins because its flexibility booster (1.5) outweighs Slow Traveler's (0.8). Slow Traveler never rewards low pace -- its defining trait.

**Fix**: Add a penalty on Slow Traveler for high pace (which it already has at `above: 0.5, weight: -1.5`) -- this is already present but not enough. The real gap is that Slow Traveler's `cultural_depth` booster (1.0) is weaker than its competitor. Raise it to 1.2, and add `restoration_need` as a booster (0.6) since slow travelers are inherently restorative.

```text
slow_traveler.boosters:
  cultural_depth: 1.0 -> 1.2   <-- strengthen core signal
  flexibility: 0.8
  food_focus: 0.6
+ restoration_need: 0.6        <-- new differentiator
```

## Fix 3: Sabbatical Scholar vs Cultural Anthropologist (74.8 vs 76.2)

**Problem**: Near-identical trait profiles. CA wins by 1.4 points because it has 4 boosters vs SS's 3, and CA's `cultural_depth` weight (1.5) edges SS's (1.2).

**Fix**: Add `planning` as a required gate for Sabbatical Scholar (`min: 0.4`). Sabbaticals require deliberate planning (leave of absence, structured learning) while Cultural Anthropologists are more spontaneous explorers. Also raise SS's `cultural_depth` booster from 1.2 to 1.5 to match CA.

```text
sabbatical_scholar.required:
  learning_focus: { min: 0.7 }
  cultural_depth: { min: 0.5 }
+ planning: { min: 0.4 }       <-- new gate (sabbaticals need planning)

sabbatical_scholar.boosters:
  learning_focus: 1.5
  cultural_depth: 1.2 -> 1.5   <-- match CA's weight
  planning: 0.5
```

Note: Adding a 3rd required gate is safe under normalization -- each gate will be worth 10 points (30/3), same budget as CA's 2 gates at 15 each.

## Fix 4: Retirement Ranger vs Midlife Explorer (61.8 vs 62.2)

**Problem**: A 0.4-point gap. Midlife Explorer's single gate gets the full 30-point budget while RR's 2 gates split it 15+15. RR already has a `lifeStageBonus` that fixes this when life stage is "free", but fails when life stage is unset.

**Fix**: Add `restoration_need` as a booster (0.6) to Retirement Ranger. Retirees seeking bucket-list experiences also want comfortable restoration between activities -- a signal that separates them from the more career-break-oriented Midlife Explorer. Also add a `planning` booster (0.4) since retirees tend to plan carefully.

```text
retirement_ranger.boosters:
  bucket_list: 1.0
  quality_intrinsic: 0.8
+ restoration_need: 0.6       <-- retirees want comfort
+ planning: 0.4               <-- retirees plan ahead
```

## Technical Details

- **One file modified**: `src/config/quiz-questions-v3.json`
- **Changes are config-only** -- no algorithm changes needed
- All changes are additive (new boosters or raised weights) -- no existing behavior removed
- The scoring engine and hard-gate logic remain untouched
- Each fix is independent and won't affect the other 22 passing archetypes

## Expected Result

| Archetype | Before | After | How |
|-----------|--------|-------|-----|
| Adrenaline Architect | Tied with BLC at 75.1 | AA wins via morning_energy boost | +3-4 points from morning_energy booster |
| Slow Traveler | Loses to FW (65.0 vs 68.8) | ST wins via stronger cultural_depth + restoration boost | +4-5 points from raised booster + new restoration signal |
| Sabbatical Scholar | Loses to CA (74.8 vs 76.2) | SS wins via planning gate + matched cultural_depth weight | Planning gate filters CA; matched booster closes gap |
| Retirement Ranger | Loses to ME (61.8 vs 62.2) | RR wins via restoration + planning boosters | +3-4 points from new boosters |

**Target accuracy: 26/26 (100%)**

