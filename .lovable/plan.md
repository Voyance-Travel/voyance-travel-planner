

## Plan: Google Routes API Caching + Retry Efficiency + Schema Fix

### Part 1: Route Cache Table
**Database migration** to create `route_cache` with a generated `cache_key` column (rounded coords + travel mode), 14-day TTL, hit counter. Service-role-only RLS. Unique index on `cache_key`, expiry index for cleanup.

### Part 2: Route Caching in optimize-itinerary
**File: `supabase/functions/optimize-itinerary/index.ts`**

- Add a module-level `getSupabaseAdmin()` helper (same pattern as `_shared/perplexity-cache.ts`) so transport functions can access the cache without threading the client through every call.
- Add `getCachedRoute()` and `setCachedRoute()` helpers near the top (after imports, before types).
- Add `parseDurationToSeconds()` and `buildInstructionsFromCache()` helpers.
- In `getGoogleRoutesTransitTransport` (line 1050): Insert cache check BEFORE the `fetch()` call. On hit, return cached result. After successful API response, write to cache (fire-and-forget).
- In `getGoogleTransport` for walking/driving modes (line 1210): Same pattern — cache check before Distance Matrix API call, cache write after.
- At the end of the main handler (before response): Add probabilistic cleanup (10% chance) to delete expired cache entries.

### Part 3: Retry Efficiency in generate-itinerary  
**File: `supabase/functions/generate-itinerary/index.ts`**

- Add `let lastGeneratedOutput: string | null = null;` before the retry loop (line ~4922).
- After the AI response is parsed into `generatedDay`, store `lastGeneratedOutput = JSON.stringify(generatedDay);`.
- Modify the retry prompt (lines 4930-4938): When `lastGeneratedOutput` exists, append the previous output as context and instruct the AI to fix only the listed errors. This reduces input tokens on retries by ~60%.

### Part 4: Make estimatedCost optional for walking
**File: `supabase/functions/generate-itinerary/index.ts`**

- Line 2402: Change `required: ["method", "duration", "estimatedCost", "instructions"]` to `required: ["method", "duration"]`.
- Line 2392-2399: Update `estimatedCost` description to say "OMIT for walking. Only include for paid transport."

### Deployment
Redeploy both `optimize-itinerary` and `generate-itinerary` edge functions.

### Expected Savings
- Route caching: ~70-80% cache hit rate on re-optimizations, saving ~$0.15-0.20/trip
- Retry efficiency: ~60% fewer input tokens on retries
- Schema fix: ~10-15% fewer retries from eliminated walk-cost validation errors

