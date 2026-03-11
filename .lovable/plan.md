

## Fix: Standardize Type Count to 29

Four files have "27" referring to traveler types/archetypes that need updating to "29":

| File | Line | Current | New |
|------|------|---------|-----|
| `src/pages/HowItWorks.tsx` | 370 | `27 traveler types` | `29 traveler types` |
| `src/pages/HowItWorks.tsx` | 390 | `Explore all 27 types` | `Explore all 29 types` |
| `src/pages/About.tsx` | 545 | `Travel DNA Quiz (27 unique types)` | `Travel DNA Quiz (29 unique types)` |
| `src/utils/pressKitGenerator.ts` | 22 | `value: '27'` (Travel DNA Archetypes) | `value: '29'` |

Additionally, code comments in edge functions reference "27 Archetypes" (trip-type-modifiers.ts, parse-travel-story, calculate-travel-dna). These are comments/internal references — updating them is optional but recommended for consistency. The trip-type-modifiers.ts has ~10 comment headers saying "All 27 Archetypes" that should become "All 29 Archetypes".

