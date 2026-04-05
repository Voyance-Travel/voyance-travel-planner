

## Phantom Pricing v7 — Already Implemented

The v7 fix you're describing was **already implemented** in the previous approved plan. All three changes are live in the codebase:

1. `src/lib/cost-estimation.ts` line 530 already has:
   `/\bexplore\b.*\b(?:district|neighborhood|neighbourhood|quarter|old\s+town|area)\b/i`

2. `src/components/itinerary/EditorialItinerary.tsx` line 1079 already uses:
   `if (isFreePublicVenue || (looksLikelyFree && !isNeverFreeCategory(category, title)))`

3. `src/hooks/usePayableItems.ts` lines 219-224 already check `isLikelyFreePublicVenue` before the never-free estimation fallback.

### What to do next

No code changes are needed. Instead, **verify the fix** by opening trip `5d720e7c` in the preview and confirming that "Explore the Chiado District" now shows **Free**. If it still shows ~€23, there may be a different root cause (e.g., the activity data has a non-zero `cost.amount` stored in the database that overrides the free-venue detection). In that case, I would need to inspect the actual activity data for that trip to diagnose further.

