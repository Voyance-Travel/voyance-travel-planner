

## Fix: Phantom Pricing on Miradouros and Praças

### Root Cause (Confirmed via DB inspection)

**The backend IS working correctly.** All four Miradouro activities already have `cost.amount = 0` in the stored `itinerary_data` JSON. The `ALWAYS_FREE_VENUE_PATTERNS` regex includes `miradouro` and `praça`, and `sanitizeGeneratedDay` → `checkAndApplyFreeVenue` zeroes them correctly.

**The bug is entirely frontend.** In `src/lib/cost-estimation.ts`, the `isLikelyFreePublicVenue()` function checks `PAID_OVERRIDE_PATTERNS` against the **combined text** (title + description + location + address). Descriptions of free venues routinely mention paid landmarks:

- "Sunset Views at the Miradouro" → description: "...panoramic views of the **castle** and the river" → `castle` matches `PAID_OVERRIDE_PATTERNS` → function returns `false`
- "Explore Praça do Comércio" → description: "...once the site of the royal **palace**" → `palace` matches → function returns `false`

Once `isLikelyFreePublicVenue` returns false, `getActivityCostInfo` in `EditorialItinerary.tsx` reaches line 1125 where `costAmount === 0 && shouldNeverBeFree` (because `sightseeing` is in `NEVER_FREE_CATEGORIES`) and falls through to the estimation engine, which produces ~€23.

Additionally, `sightseeing` should NOT be in `NEVER_FREE_CATEGORIES` — sightseeing IS often free (viewpoints, plazas, walks).

### Plan

#### 1. Fix `isLikelyFreePublicVenue` in `src/lib/cost-estimation.ts`

Check PAID_OVERRIDE_PATTERNS against **title only** (not the full combined text with description). The description is useful for free-venue pattern matching but should NOT be used for paid-override detection, because descriptions of free venues routinely mention nearby paid landmarks.

```
// Change line 592 from:
if (PAID_OVERRIDE_PATTERNS.some(p => p.test(combined))) return false;
// To:
const titleText = fields.title || '';
if (PAID_OVERRIDE_PATTERNS.some(p => p.test(titleText))) return false;
```

#### 2. Remove `sightseeing` from `NEVER_FREE_CATEGORIES` in `EditorialItinerary.tsx`

`sightseeing` is the category assigned to viewpoints, plazas, and other genuinely free venues. It should not force-estimate when cost is 0. Remove it from the array at line 988.

#### 3. No backend changes needed

The backend regex, `checkAndApplyFreeVenue`, and `sanitizeGeneratedDay` are all working correctly. No prompt changes needed either.

### Files to edit

| File | Change |
|------|--------|
| `src/lib/cost-estimation.ts` | Check paid overrides against title only, not combined text |
| `src/components/itinerary/EditorialItinerary.tsx` | Remove `sightseeing` from `NEVER_FREE_CATEGORIES` |

### Verification

- View Trip #23 (0c84133e) — "Sunset Views at the Miradouro" and "Explore Praça do Comércio" should show Free
- Generate a new Lisbon trip — all Miradouro and Praça activities should show Free
- Museums, restaurants, tours should still show prices (their titles contain paid keywords)
- Jardim activities should continue showing Free

