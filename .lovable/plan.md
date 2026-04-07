

## Michelin Inclusion for Luminary Trips + Café/Market Pricing Fix

### What's Already in Place
- `enforceMichelinPriceFloor` in `sanitization.ts` correctly raises underpriced Michelin restaurants
- `enforceCasualVenuePriceCap` exists but only covers street food (Trapizzino, Bao, etc.) — no cafés, markets, or bookshops
- `compile-prompt.ts` has Michelin inclusion rules (~line 872) but they apply to ALL trip types, not just Luminary
- `action-generate-trip-day.ts` has a diagnostic Michelin log (~line 1684) but takes no corrective action

### Changes

#### 1. `sanitization.ts` — Expand `KNOWN_CASUAL_VENUES` + add venue-type pattern matcher

Expand the `KNOWN_CASUAL_VENUES` map to include the specific overpriced venues from the bug report plus common categories:
- Shakespeare and Company Café → max €25
- Marché des Enfants Rouges → max €20
- Café de Flore, Les Deux Magots → max €45
- Ladurée, Angelina → max €50
- Borough Market, Mercato Centrale, Markthalle Neun → max €20

Add a new exported function `enforceVenueTypePriceCap()` that checks regex patterns for venue *types* (markets, bakeries, bookshop cafés, street food) and caps them even when the specific venue name isn't in the map. This catches future cases the explicit map misses.

#### 2. `compile-prompt.ts` — Make Michelin inclusion rules trip-type-aware

Replace the current generic Michelin inclusion block (~line 872) with trip-type-conditional rules:
- **Luminary**: "MUST include" language with specific minimums (1 for 3-4 days, 2 for 5-6 days, 3 for 7+). Include the known Michelin restaurant list by city so the AI has concrete options.
- **Explorer**: "Optional but encouraged" — keep current language
- **Budget/Backpacker**: "Do NOT include Michelin-starred restaurants"

The `tripType` variable is already in scope.

#### 3. `action-generate-trip-day.ts` — Upgrade Michelin diagnostic to enforcement

At ~line 1684, replace the console.warn-only diagnostic with actual Michelin injection logic for Luminary trips:
- Count Michelin restaurants across all generated days using a `KNOWN_MICHELIN_SET`
- If count is below the required minimum, find dinner slots without Michelin restaurants and swap in a fallback from a `MICHELIN_FALLBACK_BY_CITY` map
- Only inject on days that don't already have a Michelin dinner
- Log each injection with `console.warn("MICHELIN INJECTION: ...")`

#### 4. `sanitization.ts` — Call new `enforceVenueTypePriceCap` from existing callers

Wire the new function into the same call sites where `enforceCasualVenuePriceCap` is already called (in `action-generate-day.ts` and `action-generate-trip-day.ts` final pricing loops).

### Files to edit

| File | Change |
|------|--------|
| `sanitization.ts` | Expand `KNOWN_CASUAL_VENUES`, add `enforceVenueTypePriceCap()` |
| `pipeline/compile-prompt.ts` | Make Michelin rules conditional on `tripType` |
| `action-generate-trip-day.ts` | Upgrade Michelin diagnostic to injection for Luminary trips |
| `action-generate-day.ts` | Wire `enforceVenueTypePriceCap` into final pricing loop |

### What we're NOT changing
- `enforceMichelinPriceFloor` — already works correctly for price floors
- `enforceBarNightcapPriceCap` — already works
- The placeholder rejection from Prompt 59 — stays as-is
- Frontend code — no changes needed

