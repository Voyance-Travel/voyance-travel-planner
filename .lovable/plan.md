
# Fix: Normalize Required-Gate Scoring by Archetype Size

## Problem
The scoring algorithm awards a flat 30 points per required trait met, plus a 20-point "best proximity" bonus. Archetypes with more required traits get structurally higher ceilings:

- 1-gate archetypes: ~50 point ceiling (30 + 20)
- 2-gate archetypes: ~80 point ceiling (60 + 20)
- 3-gate archetypes: ~110 point ceiling (90 + 20)

This means broad archetypes like Beach Therapist (3 gates), Luxury Luminary (3 gates), and Urban Nomad (2 gates) systematically outscore specialist archetypes like Culinary Cartographer (1 gate) even when the specialist is the correct match.

## Solution: Option A -- Normalize Required Scores

Divide the total required-gate budget evenly across however many gates the archetype has. Every archetype gets the same maximum base score (30 points) from its required block, regardless of gate count.

## Changes

**File: `src/services/engines/travelDNA/archetype-matcher.ts`**

In the `calculateArchetypeScore` function, replace the fixed `score += 30` per required trait with a normalized allocation:

```typescript
const requiredTraitCount = Object.keys(required).length;
const pointsPerRequiredTrait = requiredTraitCount > 0 ? 30 / requiredTraitCount : 30;

for (const [trait, requirement] of Object.entries(required)) {
  // ... existing validation ...
  if (meetsRequirement(traitValue, requirement)) {
    matchedRequirements.push(trait);
    score += pointsPerRequiredTrait;  // was: score += 30
    traitProximities.push(1.0);
  } else {
    requiredMet = false;
    traitProximities.push(0);
  }
}
```

This single change means:
- 1-gate archetype: 30 / 1 = 30 points from gates
- 2-gate archetype: 30 / 2 = 15 points each = 30 total
- 3-gate archetype: 30 / 3 = 10 points each = 30 total

Differentiation then comes entirely from boosters and penalties, which reflect actual trait alignment rather than structural gate count.

## Expected Impact

All 7 failure clusters resolve because the structural advantage of multi-gate archetypes is eliminated:

| Cluster | Thief | Victims | Why It Fixes |
|---------|-------|---------|-------------|
| 1 | Beach Therapist | 6 archetypes | BT drops from 90+ gate points to 30; victims' boosters now competitive |
| 2 | Luxury Luminary | 2 archetypes | LL drops from 90+ gate points to 30 |
| 3 | Retirement Ranger | Collection Curator | RR drops from 60 gate points to 30 |
| 4 | Community Builder | Eco-Ethicist | CB drops from 60 gate points to 30 |
| 5 | Cultural Anthropologist | 2 archetypes | Reduced gate advantage levels the field |
| 6 | Urban Nomad | Culinary Cartographer | UN drops from 60 gate points to 30 |
| 7 | Adrenaline Architect | Bucket List Conqueror | Near-tie resolves with equalized base |

## Technical Details

- Only one file modified: `src/services/engines/travelDNA/archetype-matcher.ts`
- Only one line of logic changes (line 261: the `score += 30` becomes `score += pointsPerRequiredTrait`)
- Plus 2 lines added above the loop to compute `requiredTraitCount` and `pointsPerRequiredTrait`
- Hard-gate disqualification (the `-Infinity` for failed requirements) remains intact
- Boosters, penalties, and life-stage bonuses are untouched
- The "best proximity" bonus (lines 315-319) also benefits from this since `traitProximities` values are unchanged
