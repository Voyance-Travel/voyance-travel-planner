

## Expand Universal Free Venue Detection

### Problem
The current `ALWAYS_FREE_VENUE_PATTERNS` in `sanitization.ts` and `FREE_VENUE_PATTERNS` / `PAID_OVERRIDE_PATTERNS` in `src/lib/cost-estimation.ts` work but are missing many universal venue types from the user's expanded list — waterfront walks (corniche, seafront, lakefront), public monuments (fountain, statue, memorial), markets (souk, bazaar, feira), German/Dutch/other language bridge/garden terms, mosques, temples, shrines, synagogues, and more.

Additionally, there's no market-specific pricing cap for dining-at-market scenarios.

### What Already Works
- `checkAndApplyFreeVenue()` in sanitization.ts — tier 1/2/3 system with paid-experience exclusion
- `isLikelyFreePublicVenue()` in cost-estimation.ts — client-side free venue detection with paid overrides
- Both have pattern arrays and paid-exception lists, but they're incomplete

### Changes

#### 1. `supabase/functions/generate-itinerary/sanitization.ts`

**Expand `ALWAYS_FREE_VENUE_PATTERNS` regex** to add:
- Multilingual squares: `largo`, `campo`, `platz`
- Waterfront: `seafront`, `corniche`, `lakefront`, `canal walk`
- Monuments: `monument`, `memorial`, `statue`, `fountain`, `fontaine`, `fontana`, `brunnen`
- Religious: `mosque`, `moschee`, `mosquée`, `temple`, `shrine`, `synagogue`, `iglesia`, `chiesa`, `kirche`, `dom`
- Markets: `market`, `marché`, `mercato`, `markt`, `mercado`, `feira`, `bazar`, `bazaar`, `souk`
- German/Dutch bridges: `brücke`, `brug`
- Spanish: `puente`, `paseo`
- Neighborhood: `wander`, `walking tour`
- Overlook/belvedere: `overlook`, `belvedere`

**Expand `PAID_EXPERIENCE_RE`** to add:
- `observation deck`, `rooftop.*ticket`, `climb.*ticket`
- `boat`, `cruise`, `ferry`, `gondola`, `cable car`, `funicular`
- `show`, `concert`, `performance`, `exhibition`
- `spa`, `wellness`, `treatment`, `massage`, `hammam`
- `class`, `workshop`, `course`, `lesson`, `cooking`

**Add `enforceMarketDiningCap()`** — new exported function:
- Detects market patterns in title/venue
- If category is DINING/RESTAURANT, caps `price_per_person` at €20 instead of zeroing
- Called after `checkAndApplyFreeVenue` in the sanitization pipeline

#### 2. `src/lib/cost-estimation.ts`

**Expand `FREE_VENUE_PATTERNS`** array to match the same universal types added to sanitization.ts (monuments, waterfront, markets, multilingual religious sites, etc.)

**Expand `PAID_OVERRIDE_PATTERNS`** to add the same paid exceptions (observation deck, cable car, spa, workshop, etc.)

#### 3. Update test files

**`supabase/functions/generate-itinerary/sanitization_free_venue_test.ts`** — add tests for:
- Multilingual squares (piazza, platz, plaza)
- Waterfront/corniche/seafront
- Monuments/fountains/statues
- Markets (free entry, but dining-at-market stays paid)
- Mosques, temples, shrines
- New paid exceptions (spa, workshop, gondola)

**`src/lib/cost-estimation.test.ts`** — add tests for:
- Monument/fountain/memorial detection
- Market entry detection
- Mosque/temple detection
- New paid overrides (spa, cable car, cooking class)

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Expand `ALWAYS_FREE_VENUE_PATTERNS`, expand `PAID_EXPERIENCE_RE`, add `enforceMarketDiningCap()` |
| `src/lib/cost-estimation.ts` | Expand `FREE_VENUE_PATTERNS` and `PAID_OVERRIDE_PATTERNS` with universal types |
| `supabase/functions/generate-itinerary/sanitization_free_venue_test.ts` | Add tests for new patterns and market cap |
| `src/lib/cost-estimation.test.ts` | Add tests for new patterns and paid overrides |

### Deployment
Redeploy `generate-itinerary` edge function.

