

## Fix Venue Type Pricing — Street Food at €65, Bar Nightcaps at €143

### Root Cause

The Michelin price floor only raises prices; there's no corresponding **price ceiling** for casual venues and bar/cocktail activities. The AI assigns restaurant-tier prices to all DINING activities regardless of venue type. No post-generation cap exists for bars, nightcaps, or street food.

### Changes

#### 1. Add venue-type price caps to `sanitization.ts`

Add two new exported functions after `enforceTicketedAttractionPricing`:

**`enforceBarNightcapPriceCap(activity, logPrefix)`**
- Detect bar/nightcap activities via title keywords: `nightcap`, `cocktail`, `aperitif`, `drinks at`, `bar` (excluding `barbecue`, `barista`, `bar restaurant`)
- Skip if activity matches any `KNOWN_FINE_DINING_STARS` key (a hotel bar at a Michelin restaurant should not be capped)
- If price > 50, cap at 35 and log `BAR PRICING CAP`
- Uses existing `resolvePrice` pattern and `writePriceToAllFields`

**`enforceCasualVenuePriceCap(activity, logPrefix)`**
- `KNOWN_CASUAL_VENUES` map: `Record<string, number>` — ~10 entries (trapizzino: 15, bao: 20, five guys: 20, shake shack: 20, currywurst: 12, döner: 12, etc.)
- Check title and venue_name against keys; if price exceeds the max, cap it and log `CASUAL VENUE CAP`

#### 2. Call caps in the final guard loops

In both `action-generate-trip-day.ts` (~line 1658) and `action-generate-day.ts` (~line 1076), call the two new cap functions **before** `enforceMichelinPriceFloor` (so Michelin floor still wins for starred restaurants):

```
enforceBarNightcapPriceCap(act)
enforceCasualVenuePriceCap(act)
enforceTicketedAttractionPricing(act)
enforceMichelinPriceFloor(act)  // last — always wins
```

#### 3. Add venue-type pricing guidance to prompt (`compile-prompt.ts`)

After the "TICKETED ATTRACTION PRICING" block, add a "VENUE TYPE PRICING" section covering:
- Street food / casual quick-service: €5-15/pp
- Bar / cocktail / nightcap: €15-35/pp, never above €50
- Casual restaurants: €15-45/pp
- Upscale non-starred: €45-120/pp

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Add `KNOWN_CASUAL_VENUES`, `enforceBarNightcapPriceCap()`, `enforceCasualVenuePriceCap()` |
| `action-generate-trip-day.ts` | Call both cap functions in final guard loop before Michelin floor |
| `action-generate-day.ts` | Same — call both cap functions before Michelin floor |
| `compile-prompt.ts` | Add venue-type pricing guidelines after ticketed attraction section |

