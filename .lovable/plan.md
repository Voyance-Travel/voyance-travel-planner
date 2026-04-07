

## Universal Free Venue Detection Upgrade

### Current State

Two separate free-venue detection systems exist with overlapping but inconsistent patterns:

1. **Backend** (`sanitization.ts`): `checkAndApplyFreeVenue` — single mega-regex `ALWAYS_FREE_VENUE_PATTERNS`, plus `TIER2_FREE_VENUE_PATTERNS`, `PAID_EXPERIENCE_RE`. Checks `allTextFields` (title + venue + description + address). Has Tier 2/3 logic for edge cases.

2. **Frontend** (`cost-estimation.ts`): `isLikelyFreePublicVenue` — array of separate regexes `FREE_VENUE_PATTERNS` + `PAID_OVERRIDE_PATTERNS`. Checks paid overrides against title only (to avoid false positives from description mentions).

Both are mostly aligned but the user's spec introduces a cleaner structure. The key improvements:
- Consolidate into a clear two-array pattern (free patterns + paid exceptions)
- Add missing multilingual terms (`malecón`, `lungomare`, `pagoda`, `fuente`, `plein`)
- The paid exceptions list adds `onsen` and tightens the override patterns

### Changes

#### 1. `supabase/functions/generate-itinerary/sanitization.ts`

Update the free venue detection patterns at the top of the file:

- Replace `ALWAYS_FREE_VENUE_PATTERNS` (single mega-regex on line 17) with an array of focused regexes matching the user's `ALWAYS_FREE_VENUE_PATTERNS` spec. Add missing terms: `malecón`, `lungomare`, `plein`, `pagoda`, `fuente`
- Replace `PAID_EXPERIENCE_RE` (line 23) with an array matching the user's `PAID_EXCEPTIONS` spec. Add `onsen`
- Keep `TIER2_FREE_VENUE_PATTERNS` and Tier 3 viewpoint logic unchanged (these handle edge cases the user's spec doesn't cover, and they don't conflict)
- Update `checkAndApplyFreeVenue` to test against the new array format instead of a single regex
- Keep `enforceMarketDiningCap` unchanged (already matches the user's `enforceMarketPricing` spec)
- Export a new `shouldBeFree(activity)` convenience function that wraps the detection logic without mutating

#### 2. `src/lib/cost-estimation.ts`

Update the frontend free venue patterns:

- Replace `FREE_VENUE_PATTERNS` array (lines 519-565) with the same universal patterns from the spec, adding missing terms
- Replace `PAID_OVERRIDE_PATTERNS` array (lines 570-585) with the user's `PAID_EXCEPTIONS`, adding `onsen`
- `isLikelyFreePublicVenue` logic stays the same (title-only paid check is correct for frontend)

#### 3. `src/lib/cost-estimation.test.ts`

Add test cases for newly added patterns (pagoda, malecón, lungomare, onsen exclusion).

### What Stays Unchanged
- `checkAndApplyFreeVenue` mutation logic and cost-zeroing — unchanged
- `enforceMarketDiningCap` — already correct
- Tier 2 and Tier 3 detection in sanitization.ts — kept as additional safety nets
- `KNOWN_TICKETED_ATTRACTIONS` map — unchanged
- `universal-quality-pass.ts` — already calls these functions correctly

### Deployment
Redeploy `generate-itinerary` edge function.

