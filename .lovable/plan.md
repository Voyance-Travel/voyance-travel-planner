# M5 — Paid-tour price floor (e-Bike "Free" leak)

## Diagnosis

PROMPT B3 **shipped** (verified):
- `_shared/category-price-bounds.ts` (CATEGORY_PRICE_CEILINGS, inferSubcategory)
- `pipeline/validate-day.ts` line 198 → `checkPlausiblePricing` (emits PRICE_TOO_LOW / PRICE_IMPLAUSIBLE)
- `pipeline/repair-day.ts` §10e (median substitute on PRICE_IMPLAUSIBLE)
- `action-repair-costs.ts` (parity)

Two real gaps cause the Madrid e-Bike "Free" leak:

1. **`inferSubcategory` has no `bike_tour` / `food_tour` / `cooking_class` / `wine_tasting` / `boat_tour` cases.** An "e-Bike Tour of Retiro Park" matches none of WALKING_TOUR_RE / MUSEUM_RE / dining → returns `null` → check skipped → "Free" passes.
2. **PRICE_TOO_LOW is `autoRepairable: false`.** Even when subcategory is detected (e.g. `guided_tour_premium` at $0), the warning fires but repair-day §10e only substitutes for PRICE_IMPLAUSIBLE. The current `walking_tour` / `museum` floors are intentionally `min: 0` (some are free), but paid-only categories must auto-repair upward when $0.

## Plan

### 1. Extend category catalog (`_shared/category-price-bounds.ts`)

Add paid-tour subcategories with `min > 0`:

```ts
bike_tour:       { min: 25, max: 90,  currency: 'USD' },  // e-Bike, segway, cycling tours
food_tour:       { min: 50, max: 150, currency: 'USD' },  // tapas crawl, market tour
cooking_class:   { min: 60, max: 200, currency: 'USD' },
wine_tasting:    { min: 25, max: 150, currency: 'USD' },
boat_tour:       { min: 20, max: 200, currency: 'USD' },  // gondola/sunset/private
```

Add detection regexes in `inferSubcategory` (run BEFORE the existing WALKING_TOUR_RE check, since "bike tour" is more specific):

```ts
const BIKE_TOUR_RE     = /\b(e-?bike|electric bike|cycling|bicycle|segway)\s+(tour|experience|ride)\b|\bbike\s+tour\b/i;
const FOOD_TOUR_RE     = /\b(food|tapas|street[- ]food|market|culinary)\s+tour\b/i;
const COOKING_CLASS_RE = /\b(cooking|pasta|paella|sushi)\s+(class|workshop|experience)\b/i;
const WINE_TASTING_RE  = /\b(wine|sake|whisk(ey|y)|champagne)\s+(tasting|flight|pairing)\b/i;
const BOAT_TOUR_RE     = /\b(boat|gondola|sunset|sailing|catamaran|cruise)\s+(tour|ride|experience)\b/i;
```

### 2. Make $0 on paid-tour categories auto-repairable (`pipeline/validate-day.ts`)

In `checkPlausiblePricing` (lines 208–216), when `price < bound.min` AND `bound.min > 0`, set `autoRepairable: true` and severity `'error'`. (Floors with `min: 0` like `museum` stay non-repairable — some museums genuinely are free.)

### 3. Repair branch in `pipeline/repair-day.ts` §10e

Mirror the existing PRICE_IMPLAUSIBLE branch to also fire on `PRICE_TOO_LOW` when `bound.min > 0`. Same median write-back across all canonical fields, same `[REPAIR_PRICE_SUBSTITUTE]` log with `direction='floor_raise'`. Source tag: `category_floor_substitute`.

### 4. Parity in `action-repair-costs.ts`

Same floor-raise logic where the existing $0/implausible branch lives (around line 472–500), so the standalone repair RPC matches the inline pipeline.

### 5. Tests

`__tests__/m5-paid-tour-floor.test.ts`:
- "e-Bike Tour" $0 → detected `bike_tour`, repaired to ~$57 median
- "Tapas food tour" $0 → repaired to ~$100
- "British Museum" $0 → NOT repaired (museum min is 0)
- "Free walking tour" $0 → NOT repaired (walking_tour min is 0)
- User-locked $0 e-bike tour → NOT touched (Universal Locking)

### 6. Memory update

Update `mem://constraints/itinerary/per-category-price-sanity` to note: paid-tour subcategories with `min > 0` now bidirectionally auto-repair (floor raise + ceiling cap). Sentinel `[REPAIR_PRICE_SUBSTITUTE] direction=floor_raise`.

## Files

- `supabase/functions/generate-itinerary/_shared/category-price-bounds.ts` (catalog + regexes)
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (autoRepairable)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (§10e branch)
- `supabase/functions/generate-itinerary/action-repair-costs.ts` (parity)
- `supabase/functions/generate-itinerary/__tests__/m5-paid-tour-floor.test.ts` (new)
- `mem://constraints/itinerary/per-category-price-sanity` (update)

## Verify

Generate a Madrid trip with an e-Bike tour → card should price at ~$55–60/pp with `priceSource: 'category_floor_substitute'`, never "Free".
