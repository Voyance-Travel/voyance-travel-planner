

## Archetype Count Audit: 27 vs Actual

### Finding

The scoring engine (`calculate-travel-dna/index.ts`) contains **32 entries**, but they break down as:

| Category | Displayed (27) | Missing from Display | Fallbacks |
|----------|----------------|---------------------|-----------|
| Explorer | 4 | - | 3 (balanced_story_collector, flexible_wanderer, explorer) |
| Connector | 4 (missing community_builder) | 1 | - |
| Achiever | 4 | - | - |
| Restorer | 6 | - | - |
| Curator | 4 (missing curated_luxe) | 1 | - |
| Transformer | 5 | - | - |

- **27** are fully designed archetypes shown on the Archetypes page
- **2** real archetypes exist in scoring but are hidden from display: `community_builder` (Connector) and `curated_luxe` (Curator)
- **3** are fallback/catch-all archetypes for edge cases (not meant to be showcased)

### Recommendation

Update the count to **29** by adding the 2 missing real archetypes to the display page. The 3 fallbacks are safety nets, not featured types.

### Changes Required

**1. Add missing archetypes to Archetypes page** (`src/pages/Archetypes.tsx`)
- Add `community_builder` to CONNECTOR array
- Add `curated_luxe` to CURATOR array
- Update comment from "27" to "29"

**2. Update all "27" references across the site** (10 files):

| File | What to change |
|------|---------------|
| `src/components/common/TopNav.tsx` | "See all 27 traveler types" -> "See all 29 traveler types" |
| `src/components/home/TheInsightSection.tsx` | "27 Travel Archetypes" badge -> "29" |
| `src/components/home/SampleArchetype.tsx` | "27 unique archetypes" and "See all 27" -> "29" |
| `src/components/home/SocialProofSection.tsx` | `archetypesAvailable: 27` -> `29` |
| `src/components/home/DNAHowItWorks.tsx` | "from 27 types" -> "from 29 types" |
| `src/pages/HowItWorks.tsx` | "27 distinct traveler types" and "27 traveler types" -> "29" |
| `src/pages/Archetypes.tsx` | Description meta + body text referencing "27" -> "29" |
| `src/lib/strangerCopy.ts` | `typesCount: "27 traveler types"` -> "29" |
| `src/config/quiz-questions-v3.json` | `targetArchetypes: 27` -> `29` |
| `src/services/engines/travelDNA/archetype-matcher.ts` | Comment "27 travel archetypes" -> "29" |
| `src/data/archetypeReveals.ts` | Comment "27 Archetype Reveals" -> "29" |

**3. Ensure narrative data exists** for `community_builder` and `curated_luxe` in `archetypeNarratives.ts` (they likely already do since they're scoreable).

