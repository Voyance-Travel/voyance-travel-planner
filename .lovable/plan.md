

## Expand Universal Venue-Type Price Caps

### Current State
The system already has the architecture the user described, split across three functions:
- `enforceBarNightcapPriceCap()` — handles bars, nightcaps, cocktails (cap €35, max €50)
- `enforceCasualVenuePriceCap()` — handles known venue names (city-specific map)
- `enforceVenueTypePriceCap()` — handles regex-based category caps (markets €20, bakeries €25, street food €15, bookshop cafés €25)

The existing `CASUAL_VENUE_TYPE_PATTERNS` array is missing several categories from the user's list.

### Changes

**File: `supabase/functions/generate-itinerary/sanitization.ts`**

Expand `CASUAL_VENUE_TYPE_PATTERNS` (line 747) to add these missing patterns:

| Pattern | Max Price | Notes |
|---------|-----------|-------|
| `gelato\|ice cream\|gelateria\|glacier\|frozen yogurt\|dessert shop` | €15 | Ice cream and dessert shops |
| `fast casual\|quick bite\|grab and go\|take.?away\|to go` | €20 | Fast casual / quick service |
| `nightcap\|cocktail\|drinks\|aperitif\|apéro\|late night` | €50 | Already handled by `enforceBarNightcapPriceCap` — skip to avoid conflict |
| `casual\|simple\|corner` in "Breakfast/Lunch at a..." | €25 | Casual unnamed cafés |
| `panadería\|padaria` | €25 | Spanish/Portuguese bakeries (extend existing bakery pattern) |

Specifically:
1. Add gelato/ice cream/dessert pattern (€15)
2. Add fast casual/quick bite pattern (€20)
3. Extend bakery pattern to include `panadería` and `padaria`
4. Add casual café pattern for "Breakfast at a casual..." titles (€25)
5. Skip bar/nightcap/cocktail — already covered by the dedicated `enforceBarNightcapPriceCap` function with its own logic and Michelin exclusions

No new functions needed. No new files. Just expanding the existing pattern array.

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Add 3-4 entries to `CASUAL_VENUE_TYPE_PATTERNS` array |

### Deployment
Redeploy `generate-itinerary` edge function.

