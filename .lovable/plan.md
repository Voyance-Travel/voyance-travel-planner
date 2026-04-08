
What this error actually means

- This is most likely not a real “CORS configuration” problem.
- The edge function is crashing at runtime, and because the request is cross-origin (`travelwithvoyance.com` -> function host), the browser surfaces the failed 500 as a CORS-style error.
- The strongest evidence is in the function logs:  
  `[generate-day] Error: TypeError: (act.address || act.location || "").trim is not a function`

Root cause I found

- In `supabase/functions/generate-itinerary/action-generate-day.ts`, the post-processing filters assume `address`/`location` are strings and call `.trim()` directly.
- But some AI-generated activities are arriving with object-shaped `address` or `location` values, so `.trim()` throws.
- The current codebase still has the risky patterns in:
  - `action-generate-day.ts`
    - hallucination filter
    - filler activity filter
  - `action-generate-trip-day.ts`
    - same two filters
- The deployed log points to line 320 in an older compiled version; in the current source, the equivalent risky blocks are the filters that do:
  - `(act.address || ...).trim()`
  - `(act.address || act.location || '').trim()`

Why the retries happen

- The frontend regeneration flow retries Day 1 after each 500.
- Since the same bad activity shape hits the same `.trim()` crash every time, each retry fails the same way.
- `repairTripCosts error: FunctionsFetchError` is likely a downstream symptom of the same edge-function failure path, not the primary bug.

Implementation plan

1. Harden address/location normalization in `action-generate-day.ts`
   - Replace direct `.trim()` calls with a safe string extractor.
   - Support:
     - plain strings
     - `{ address }` objects
     - `{ name }` objects
     - null/undefined
   - Use the normalized string in both the hallucination filter and filler filter.

2. Apply the same hardening in `action-generate-trip-day.ts`
   - Fix the identical risky `.trim()` patterns there too.
   - This is important because the day-chaining flow also runs these filters and can hit the same crash.

3. Do not start with CORS config changes
   - `index.ts` already handles `OPTIONS` and adds CORS headers on normal error responses.
   - Based on the logs, the first fix should be the runtime exception, not origin allowlisting.

Technical details

- Safe helper approach:
  - derive a string from `act.address`, `act.location.address`, `act.location.name`, or string `act.location`
  - only then call `.trim()`
- This should be reused consistently in both files so mixed payload shapes do not crash filtering.
- After this fix, the browser should stop showing the misleading CORS error for this failure path because the function should no longer explode mid-generation.

Files to update

- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

Verification

- Regenerate the same trip/day from `travelwithvoyance.com`.
- Confirm the browser no longer shows the CORS/500 retry loop.
- Confirm edge logs no longer show `.trim is not a function`.
- Confirm Day 1 advances past post-processing and returns JSON successfully.
- If a CORS error still appears after the runtime fix, then investigate true platform-level CORS behavior separately — but the current evidence points to the crash above as the real issue.
