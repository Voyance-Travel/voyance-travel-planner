
Diagnosis

- This is still most likely a runtime crash, not a true CORS configuration problem.
- The latest backend log shows:
  `TypeError: (act.address || act.location || "").trim is not a function`
- The current source explains why the 500 is still happening:
  - `supabase/functions/generate-itinerary/action-generate-day.ts` still has an unsafe hallucination-filter line that calls `.trim()` on `act.address` before confirming it is a string.
  - `supabase/functions/generate-itinerary/action-generate-trip-day.ts` has the same unsafe pattern.
- The filler filters were already partially hardened, so the earlier fix was incomplete. The remaining crash point is the hallucination filter.
- Because the function throws before it finishes a normal response, the browser surfaces the failure as a misleading CORS-style error.

Implementation plan

1. Harden the hallucination filter in `action-generate-day.ts`
   - Replace the direct address `.trim()` logic with safe normalization.
   - Support:
     - string `act.address`
     - object `act.address.address`
     - object `act.address.name`
     - string `act.location`
     - object `act.location.address`
     - object `act.location.name`
     - empty fallback

2. Apply the same hardening in `action-generate-trip-day.ts`
   - Keep both generation paths consistent so single-day regeneration and chained trip generation cannot fail on the same payload shape.

3. Normalize both filters consistently
   - While touching the code, reuse the same address extraction approach in hallucination and filler filtering within each file so future AI payload shape changes do not reintroduce this bug.
   - Do not start with CORS header changes; fix the exception path first.

Files to update

- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

Technical details

- The core bug is that `act.address` can be truthy but non-string, so `(...).trim()` throws.
- The safe flow should be:
  - extract a string value from `address` or `location`
  - default to `''`
  - only then call `.trim()`

Verification

- Regenerate the failing day again.
- Confirm the request no longer returns 500 and the retry loop stops.
- Confirm backend logs no longer show `.trim is not a function`.
- If a CORS message still appears after this runtime fix, then inspect the response headers separately as a second step.
