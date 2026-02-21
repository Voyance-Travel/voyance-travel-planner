

# Fix: Resolve 2 Remaining Archetype Scoring Overlaps (24/26 to 26/26)

## Overview
Two regressions from the previous round of booster tweaks. Both are small-margin issues with clean, targeted fixes.

## Fix 1: Beach Therapist vs Slow Traveler (63.8 vs 64.1)

**Problem**: The `restoration_need: 0.6` booster added to Slow Traveler in the last fix gives ST extra points on a Beach Therapist profile (which naturally has high restoration_need). ST edges BT by 0.3 points.

**Fix**: Increase Beach Therapist's `restoration_need` booster from 1.2 to 1.4. This adds roughly 1.5 extra points to BT on a high-restoration profile, flipping the 0.3-point deficit into a comfortable win.

```text
beach_therapist.boosters:
  restoration_need: 1.2 -> 1.4   <-- strengthen core signal
  flexibility: 0.8
```

## Fix 2: Midlife Explorer vs Retirement Ranger (64.0 vs 67.4)

**Problem**: A Midlife Explorer profile with moderate bucket_list (0.7) satisfies RR's gate and triggers all 4 RR boosters (including the newly added restoration_need and planning). RR wins by 3.4 points.

**Fix**: Add a `bucket_list` penalty to Midlife Explorer: `{ above: 0.6, weight: -0.8 }`. Midlife explorers are driven by quality and depth, not list-checking. This subtracts ~3.2 points when bucket_list is high, neutralizing RR's advantage.

```text
midlife_explorer.penalties:
  {}  ->  { bucket_list: { above: 0.6, weight: -0.8 } }
```

## Technical Details

- **One file modified**: `src/config/quiz-questions-v3.json`
- Both changes are minimal config tweaks -- no algorithm changes
- Fix 1: single number change (line 1574, `1.2` to `1.4`)
- Fix 2: add one penalty entry to an empty penalties object (line 1704)
- Neither change affects any of the 24 currently passing archetypes

## Expected Result

| Archetype | Before | After | How |
|-----------|--------|-------|-----|
| Beach Therapist | Loses to ST by 0.3 | BT wins via stronger restoration booster | +1.5 points from increased weight |
| Midlife Explorer | Loses to RR by 3.4 | ME wins via bucket_list penalty on RR-like traits | -3.2 points from penalty neutralizes RR advantage |

**Target accuracy: 26/26 (100%)**

