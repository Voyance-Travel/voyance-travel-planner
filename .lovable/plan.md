# Walking-Tour Bimodal Split (M5 Addendum)

Close the only remaining coverage gap in `CATEGORY_PRICE_CEILINGS`: paid walking tours currently fall through to `walking_tour { min: 0 }`, so an LLM-hallucinated $0 paid guided tour passes silently (the inverse of the Madrid e-bike case, which is already caught by `bike_tour { min: 25 }`).

Cooking_class ($60) and wine_tasting ($25) floors stay as shipped — those are sensitivity tradeoffs, not coverage gaps.

## Scope

### 1. `supabase/functions/generate-itinerary/_shared/category-price-bounds.ts`

- Extend `PriceCategoryKey` union with `'walking_tour_paid'`.
- Add bound: `walking_tour_paid: { min: 15, max: 80, currency: 'USD' }`.
- Add two regexes:
  ```ts
  const PAID_WALKING_TOUR_RE = /\b(paid|guided|premium|private|food|tapas|wine|history|historical|ghost|architecture|street[- ]art)\s+walking\s+tour\b/i;
  const FREE_WALKING_TOUR_RE = /\bfree\s+(walking\s+)?tour\b/i;
  ```
- In `inferSubcategory`, insert the bimodal split **before** the existing experience block (paid wins on tie):
  ```
  if (PAID_WALKING_TOUR_RE.test(haystack)) return 'walking_tour_paid';
  if (FREE_WALKING_TOUR_RE.test(haystack)) return 'walking_tour';
  // ... existing BIKE_TOUR_RE / FOOD_TOUR_RE / etc.
  // generic WALKING_TOUR_RE remains as the bare fallback
  ```
- Note: a "paid food walking tour" must hit `walking_tour_paid` (paid prefix beats food tour). Ordering above guarantees it.

### 2. `supabase/functions/generate-itinerary/__tests__/m5-paid-tour-floor.test.ts`

Add four cases:
- `"Guided Walking Tour of Madrid Old Town"` $0 → `walking_tour_paid`, `PRICE_TOO_LOW` fires (severity error), repair substitutes median ≈ $47.
- `"Free Walking Tour of Centre"` $0 → `walking_tour`, no violation.
- `"Paid food walking tour of La Latina"` $0 → `walking_tour_paid` (paid prefix wins over food).
- Locked `"Premium walking tour"` ($0, `is_locked: true`) → `shouldSkipPriceSanity` returns true, no violation.

No changes needed to:
- `validate-day.ts::checkPlausiblePricing` (already iterates `bound.min` generically).
- `repair-day.ts` §10e (already handles `PRICE_TOO_LOW` → median substitute, `direction: 'floor_raise'`, `priceSource: 'category_floor_substitute'`).
- `action-repair-costs.ts` (mirrors via `inferSubcategory` + `CATEGORY_PRICE_CEILINGS` lookup — picks up the new key automatically).

### 3. Memory

Update `mem://constraints/itinerary/per-category-price-sanity` with one line: "Walking tours are bimodal: `walking_tour_paid` (min $15, regex match on paid|guided|premium|private|food|tapas|wine|history) runs before generic `walking_tour` (min $0). Closes inverse Madrid e-bike case for paid walking tours."

No core-rule index change (covered by existing Per-Category Price Sanity bullet).

## Out of Scope

- Lowering cooking_class / wine_tasting floors (per user: not a coverage gap).
- Repairing the existing Madrid e-bike trip (stale data — user will run `action-repair-costs` once on that trip).
- New regex categories for segway/photo-walks/ghost-tours beyond the keyword list above (revisit if telemetry shows misses).

## Verification

- New tests in `m5-paid-tour-floor.test.ts` pass via `supabase--test_edge_functions`.
- Existing M5 tests still pass (regex ordering must not regress `walking_tour` free-tour case).
