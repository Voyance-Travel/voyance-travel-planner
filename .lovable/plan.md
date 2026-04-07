

## Universal Price Sanity — Align Category-Based Caps

### Current State

The backend (`sanitization.ts`) already has three separate price cap functions that cover the same ground as the user's `PRICE_CAPS` spec, but with slightly different values:

| Category | User Spec | Current Code | Location |
|---|---|---|---|
| Bakery/boulangerie | €35 | €25 | `CASUAL_VENUE_TYPE_PATTERNS` |
| Bookshop/bookstore | €25 | €25 | `CASUAL_VENUE_TYPE_PATTERNS` ✓ |
| Street food | €18 | €15 | `CASUAL_VENUE_TYPE_PATTERNS` |
| Gelato/ice cream | €15 | €15 | `CASUAL_VENUE_TYPE_PATTERNS` ✓ |
| Nightcap/cocktail | €55 | €50 max / €35 default | `enforceBarNightcapPriceCap` |

The existing system is **more comprehensive** than the spec (includes Michelin exclusions, venue-specific maps, multiple field shape writes). The spec's values are slightly more generous for bakeries (€35 vs €25), street food (€18 vs €15), and nightcaps (€55 vs €50).

### Changes

#### `supabase/functions/generate-itinerary/sanitization.ts`

1. **Update `CASUAL_VENUE_TYPE_PATTERNS`** (lines 783-796):
   - Bakery/boulangerie/patisserie: `maxPrice` from 25 → **35**
   - Street food/food stall/hawker: `maxPrice` from 15 → **18**
   - Bookshop and gelato already match — no change

2. **Update bar/nightcap constants** (lines 663-664):
   - `MAX_BAR_PRICE` from 50 → **55**
   - `DEFAULT_BAR_PRICE` stays at 35 (the spec's €55 is a ceiling, not a default)

No new functions needed — the existing three-function system (`enforceBarNightcapPriceCap`, `enforceCasualVenuePriceCap`, `enforceVenueTypePriceCap`) already covers all the user's patterns with better granularity (Michelin exclusions, venue-specific maps, multi-field writes).

### What Stays Unchanged
- `enforceCasualVenuePriceCap` with `KNOWN_CASUAL_VENUES` map — unchanged
- `enforceVenueTypePriceCap` function logic — unchanged (just cap values updated)
- `enforceBarNightcapPriceCap` function logic — unchanged (just ceiling updated)
- `enforceMichelinPriceFloor` — unchanged
- `universal-quality-pass.ts` — already calls all three functions
- Frontend (`cost-estimation.ts`) — no changes needed (caps are backend-only)

### Deployment
Redeploy `generate-itinerary` edge function.

