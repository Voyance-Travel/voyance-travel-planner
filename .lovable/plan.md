

## DNA-Aware Dining Configuration

### Goal
Create a dining configuration system that maps each archetype tier and specific archetype to dining behavior (price ranges, Michelin policy, dining style, avoid patterns). Wire it into prompt compilation and placeholder replacement so dining recommendations are personalized by traveler DNA.

### New File: `supabase/functions/generate-itinerary/dining-config.ts`

Contains the full `DiningConfig` interface, `TIER_DINING_DEFAULTS` (6 tiers: Explorer, Connector, Achiever, Restorer, Curator, Transformer), `ARCHETYPE_OVERRIDES` (per-archetype exceptions), and `getDiningConfig(tier, archetype)` function. Directly implements the data tables from the user's specification.

### Wire Into `pipeline/compile-prompt.ts`

Currently the Michelin/dining section (lines 865-942) uses only `tripType` (luminary/budget/explorer) to decide dining rules. Replace this with DNA-aware logic:

1. Import `getDiningConfig` from `dining-config.ts`
2. After profile loading (~line 506), resolve the archetype's category from `profile.archetypeContext.definition.category`
3. Call `getDiningConfig(category, primaryArchetype)` to get the config
4. Replace the hardcoded Michelin prompt block (lines 872-905) with config-driven output:
   - Use `config.michelinPolicy` to decide mandatory/encouraged/optional/discouraged
   - Use `config.michelinMinByTripLength` for required counts
   - Inject `config.diningStyle` as the AI's dining guidance
   - Inject `config.avoidPatterns` as explicit dining exclusions
   - Inject `config.priceRange` as per-meal price guidance brackets
5. Keep the existing restaurant naming rules and city-specific examples (lines 906-942) unchanged

The dining prompt block will look like:
```
DINING PERSONALITY (from traveler DNA):
Style: {config.diningStyle}
Avoid: {config.avoidPatterns.join(', ')}
Price guidance per person: Breakfast €{min}-{max}, Lunch €{min}-{max}, Dinner €{min}-{max}
{michelinBlock based on policy + trip length}
```

### Wire Into `fix-placeholders.ts`

When replacing placeholder meals, pass the `diningStyle` and `priceRange` from the config so replacement restaurants match the traveler's DNA. Update `fixPlaceholdersForDay` signature to accept an optional `DiningConfig` parameter, and include it in the replacement prompt.

### Wire Into `universal-quality-pass.ts`

Add optional `diningConfig` to `UniversalQualityOptions`. Pass it through to `fixPlaceholdersForDay`. No other quality steps need the config (price caps in sanitization.ts remain as safety nets).

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/dining-config.ts` | **New** — DiningConfig interface, tier defaults, archetype overrides, `getDiningConfig()` |
| `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` | Import dining config; replace hardcoded Michelin/dining block with DNA-driven prompt |
| `supabase/functions/generate-itinerary/fix-placeholders.ts` | Accept optional `DiningConfig`, use style/price in replacement prompts |
| `supabase/functions/generate-itinerary/universal-quality-pass.ts` | Add `diningConfig` to options, pass through to placeholder fixer |

### What Stays Unchanged
- `enforceMichelinPriceFloor()` in sanitization.ts — still enforces minimum pricing as a safety net
- Restaurant naming rules and city-specific examples in compile-prompt.ts — kept as-is
- `destination-guides.ts` per-archetype diningStyle — coexists (destination-level is more specific)
- Archetype constraints and profile loader — untouched

### Deployment
Redeploy `generate-itinerary` edge function.

