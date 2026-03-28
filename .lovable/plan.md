

## Fix Ghost ~$50 Price on Free Activities

### Problem
Free attractions (Meiji Shrine, Tsukiji Market, Nihonbashi Bridge) show ~$50/pp because `NEVER_FREE_CATEGORIES` includes broad categories like `'activity'`, `'sightseeing'`, `'market'`, `'cultural'`, `'attraction'`. The existing `FREE_ATTRACTION_KEYWORDS` check at line 1066 tries to catch these but loses to `isNeverFreeCategory()` later in the flow. Additionally, `usePayableItems.ts` has its own `NEVER_FREE_CATEGORIES` list with the same problem, and descriptions containing "free entry" or "free to explore" are never checked.

### Changes

**1. `src/components/itinerary/EditorialItinerary.tsx` — Expand and prioritize free detection**

- Expand `FREE_ATTRACTION_KEYWORDS` with: `'shrine'`, `'temple'`, `'torii'`, `'gate'`, `'passage'`, `'cemetery'`, `'memorial'`, `'boardwalk'`, `'riverbank'`, `'canal'`, `'pier'`, `'harbor walk'`, `'old town'`, `'district walk'`, `'fish market'`, `'tsukiji'`, `'nishiki'`, `'la boqueria'`, `'grand bazaar'`.

- Add `FREE_DESCRIPTION_INDICATORS` array: `'free to explore'`, `'free entry'`, `'free to visit'`, `'free admission'`, `'no entrance fee'`, `'no entry fee'`, `'free to enter'`, `'free to walk'`, `'free of charge'`, `'no cost'`.

- In `getActivityCostInfo()`, add a description check **before** the `shouldNeverBeFree` path (~line 1069–1071): if the activity description contains any free indicator, return `amount: 0` immediately regardless of category.

- Broaden the `looksLikelyFree` category check to also accept `'cultural'`, `'market'`, `'explore'` in addition to existing values.

- Make `looksLikelyFree` **take priority over** `shouldNeverBeFree` by moving the free-check block before the `shouldNeverBeFree` assignment and ensuring it returns early. Already partially done but the `isNeverFreeCategory` guard prevents it from working for categories like `'market'` — remove that guard for keyword-matched items.

**2. `src/hooks/usePayableItems.ts` — Add free-attraction bypass**

- Add the same `FREE_ATTRACTION_KEYWORDS` and `FREE_DESCRIPTION_INDICATORS` arrays.
- Before the `shouldNeverBeFree` check at line 218, add: if the title matches a free keyword or description contains a free indicator, skip the estimation fallback and leave cost at 0.

**3. `src/lib/cost-estimation.ts` — Add free-activity short-circuit in `estimateCostSync`**

- After the accommodation block (~line 342) and before the explicit cost check, add a title-based free-attraction check using the same keyword list. If matched, return `amount: 0` with `source: 'category_estimate'`, `reason: 'Commonly free attraction'`.

**4. Backend: `supabase/functions/generate-itinerary/action-repair-costs.ts`**

- In the repair loop, before assigning `costPerPerson` from the reference table, check if the activity title matches free-attraction keywords. If so, set `costPerPerson = 0` and `source = 'free_attraction'`.

**5. Redeploy** the `generate-itinerary` edge function.

### Technical Detail
The root cause is that `NEVER_FREE_CATEGORIES` is too broad — it includes `'activity'`, `'sightseeing'`, `'market'`, and `'cultural'` which catches shrines, parks, and markets. Rather than narrowing that list (which would break paid activities), the fix adds an early-exit path for known-free attractions that takes priority. Description-based detection (`"free entry"`, `"free to explore"`) provides a second layer that works regardless of category.

