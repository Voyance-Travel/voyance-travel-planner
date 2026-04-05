

## Fix Phantom Pricing v7 — Trust Free Venue Detector Over NEVER_FREE_CATEGORIES

### Root Cause

"Explore the Chiado District" shows ~€23 because of two issues:

1. **`isLikelyFreePublicVenue` doesn't match it** — the `FREE_VENUE_PATTERNS` regex `/\bdistrict\s+(?:walk|stroll|explore)\b/i` requires "district walk" (word order: district first), but the title is "Explore the Chiado **District**" (explore first). There's no pattern for `explore.*district`.

2. **Even if it did match, `isNeverFreeCategory` vetoes it** — at line 1079 of `EditorialItinerary.tsx`:
   ```
   if ((looksLikelyFree || isFreePublicVenue) && !isNeverFreeCategory(category, title))
   ```
   The activity's category is likely `activity` or `sightseeing`, both in `NEVER_FREE_CATEGORIES`. So `isNeverFreeCategory` returns `true`, blocking the free detection even when the shared helper says it's free.

### Fix (3 changes across 2 files)

**File 1: `src/lib/cost-estimation.ts`**

Add patterns to `FREE_VENUE_PATTERNS` for "explore" + area:
- `/\bexplore\b.*\b(?:district|neighborhood|neighbourhood|quarter|old\s+town|area)\b/i`
- `/\bstroll\b.*\b(?:district|neighborhood|neighbourhood|quarter)\b/i`

This catches "Explore the Chiado District", "Explore the Gothic Quarter", etc.

**File 2: `src/components/itinerary/EditorialItinerary.tsx`**

Change the logic at line 1079: when `isLikelyFreePublicVenue` returns `true`, **trust it** — don't let `isNeverFreeCategory` override. The shared helper already excludes dining, transport, ticketed, and wellness categories internally, so double-checking is redundant and causes misses.

Change from:
```ts
if ((looksLikelyFree || isFreePublicVenue) && !isNeverFreeCategory(category, title)) {
```
To:
```ts
if (isFreePublicVenue || (looksLikelyFree && !isNeverFreeCategory(category, title))) {
```

This means: `isLikelyFreePublicVenue` is authoritative (it has its own paid-override checks). The older `looksLikelyFree` heuristic still respects `isNeverFreeCategory`.

**File 3: `src/hooks/usePayableItems.ts`**

Apply the same priority change — if `isLikelyFreePublicVenue` says free, skip the item regardless of category.

### Files to edit
- `src/lib/cost-estimation.ts` — add explore+district pattern
- `src/components/itinerary/EditorialItinerary.tsx` — trust `isLikelyFreePublicVenue` over `NEVER_FREE_CATEGORIES`
- `src/hooks/usePayableItems.ts` — same trust fix

### Verification
Open trip `5d720e7c`. "Explore the Chiado District" should show Free. All other free venues (Sunset Stroll, Viewpoint walks, Park strolls) should remain Free. Dining/ticketed items should keep their prices.

