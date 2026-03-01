

# Fix: Urban Nomad Over-Assignment Bug

## Problem
Urban Nomad is being assigned to too many users because its archetype profile has the weakest gates of any archetype and strong boosters on generic traits.

**Why it wins so often:**
- Its `novelty_seeking >= 0.5` gate passes at the DEFAULT value (0.5) -- zero quiz signal needed
- Its `nature_orientation <= 0.3` gate triggers for anyone who picks even one city-oriented answer
- Its boosters (novelty_seeking 1.2, pace 1.0, flexibility 0.8, social_energy 0.6) reward common/moderate trait values that most quiz-takers have
- Most competing archetypes require specialized high traits (food >= 0.75, art >= 0.7, etc.) that fewer users reach

## Solution: Tighten Urban Nomad's profile and add a missing archetype discriminator

### Change 1: Tighten Urban Nomad required gates
In `src/config/quiz-questions-v3.json`, update `urban_nomad.required`:

**Before:**
```json
"required": {
  "nature_orientation": { "max": 0.3 },
  "novelty_seeking": { "min": 0.5 }
}
```

**After:**
```json
"required": {
  "nature_orientation": { "max": 0.25 },
  "novelty_seeking": { "min": 0.6 },
  "pace": { "min": 0.5 }
}
```

- `nature_orientation` tightened from 0.3 to 0.25 -- must genuinely prefer cities, not just "not nature"
- `novelty_seeking` raised from 0.5 to 0.6 -- must show active novelty-seeking, not just the default
- `pace >= 0.5` added -- Urban Nomads should be at least moderate-paced (city energy)

### Change 2: Reduce Urban Nomad booster weights
**Before:**
```json
"boosters": {
  "novelty_seeking": 1.2,
  "pace": 1.0,
  "flexibility": 0.8,
  "social_energy": 0.6
}
```

**After:**
```json
"boosters": {
  "novelty_seeking": 1.0,
  "pace": 0.7,
  "flexibility": 0.5,
  "social_energy": 0.4
}
```

This brings total booster potential from 3.6 down to 2.6, in line with other archetypes.

### Change 3: Add stronger penalties
**Before:**
```json
"penalties": {
  "nature_orientation": { "above": 0.5, "weight": -1.5 },
  "restoration_need": { "above": 0.7, "weight": -0.8 },
  "spirituality": { "above": 0.6, "weight": -0.5 }
}
```

**After:**
```json
"penalties": {
  "nature_orientation": { "above": 0.4, "weight": -2.0 },
  "restoration_need": { "above": 0.6, "weight": -1.0 },
  "spirituality": { "above": 0.5, "weight": -0.8 },
  "planning": { "above": 0.7, "weight": -0.5 }
}
```

Heavy planners are less likely to be true "nomads."

### Change 4: Fix legacy fallback mappings
In `src/data/archetypeNarratives.ts`, `solo_explorer` and `city_explorer` both silently map to `urban_nomad`. This is a secondary source of over-assignment for users coming through non-quiz paths. Update:

```
'solo_explorer' -> 'flexible_wanderer'   (solo != urban)
'city_explorer' -> 'urban_nomad'         (keep -- this one is correct)
```

## Files changed
1. `src/config/quiz-questions-v3.json` -- tighten urban_nomad required, boosters, penalties
2. `src/data/archetypeNarratives.ts` -- fix solo_explorer mapping

## Why this works
- The tighter gates mean users must demonstrate genuine city-lover traits, not just "average"
- Lower boosters prevent urban_nomad from outscoring archetypes that actually match
- Stronger penalties push borderline cases toward more fitting archetypes
- The solo_explorer mapping fix stops non-quiz users from defaulting into urban_nomad

## Risk
Existing users who were assigned Urban Nomad won't change automatically -- their DNA is already stored. Only new quiz completions and DNA recalculations will use the updated profile. No data migration needed.

