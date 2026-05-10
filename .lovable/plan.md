## Even-split group DNA blending

**Problem:** `blendTravelDna` in `src/utils/dnaBlending.ts` gives the trip owner a fixed 50% weight and splits the other 50% across companions. With 3 travelers the owner has 50% influence vs 25%/25% for companions; with 4 it's 50% vs 16.7%×3. Itineraries skew toward the owner's archetype.

**Goal:** Equal per-traveler weight regardless of who created the trip — 50/50 for 2, 33.3/33.3/33.3 for 3, 25/25/25/25 for 4.

### Change

In `src/utils/dnaBlending.ts`, the blending branch (lines ~90–129, after the early returns):

```ts
// Even split across owner + included companions
const totalTravelers = 1 + includedCompanions.length;
const evenWeight = 1 / totalTravelers;

// Collect all trait keys
const allTraitKeys = new Set<string>();
Object.keys(owner.traitScores).forEach(k => allTraitKeys.add(k));
includedCompanions.forEach(c => Object.keys(c.traitScores).forEach(k => allTraitKeys.add(k)));

// Blend traits — every traveler weighted equally
const blendedTraits: Record<string, number> = {};
for (const key of allTraitKeys) {
  const ownerScore = (owner.traitScores[key] ?? 0) * evenWeight;
  const companionSum = includedCompanions.reduce(
    (sum, c) => sum + (c.traitScores[key] ?? 0) * evenWeight,
    0
  );
  blendedTraits[key] = Math.round(ownerScore + companionSum);
}

const travelerProfiles = [
  { userId: owner.userId, name: owner.name, archetypeId: owner.archetypeId, isOwner: true,  weight: evenWeight },
  ...includedCompanions.map(c => ({
    userId: c.userId, name: c.name, archetypeId: c.archetypeId, isOwner: false, weight: evenWeight,
  })),
];

return {
  blendedTraits,
  dominantArchetype: owner.archetypeId,   // tie-break only; influence is even
  travelerProfiles,
  blendMethod: 'weighted_average',
  ownerWeight: evenWeight,                 // now reports the actual share
  isBlended: true,
};
```

### Notes / scope

- **Doc comment update** at line ~40–48 to say *"Each included traveler gets an equal share (1 / N). Companions with `includePreferences=false` are excluded from the count."*
- **`ownerWeight` field on `BlendedDnaResult`** is kept for type/back-compat but now carries the actual even-split share. Audit confirms no external consumer compares it against `0.5`; only this file writes it and `BlendedProfilesCard` doesn't read it.
- **`dominantArchetype`** stays as the owner's archetype — it's only used as a tie-break label for the blended profile, not as a weighting input. (If you'd rather pick by highest blended-trait match, that's a separate change.)
- **Early-return branches** (no owner / no included companions) are unchanged — they already represent 100%-single-traveler cases where even-split degenerates correctly.
- **No other files** need editing. `BlendedProfilesCard.tsx` only consumes `blendedTraits` + `travelerProfiles[].weight`, both of which update automatically.

### Verification

1. **Unit-shape sanity:** with owner pace=8 and two companions pace=2, pace=2 → blended pace = round((8+2+2)/3) = 4 (was 5 under old math).
2. **3-traveler trip** (Cultural Anthropologist + Adrenaline Architect + Zen Seeker): inspect `BlendedProfilesCard` — each traveler row should display 33% weight; generated itinerary mixes museum/adventure/wellness instead of museum-dominant.
3. **2-traveler trip:** weights show 50/50 (unchanged behavior).
4. **Companion with `includePreferences=false`:** excluded from N, remaining travelers split evenly (e.g. owner + 2 companions where 1 opts out → 50/50 between owner and the 1 included companion).
