

## Fix 23J: Edge Function Resilience — CORS Crash Recovery & SVG Console Errors

### Changes

**File 1: `supabase/functions/generate-itinerary/index.ts`**

1. **Global CORS safety wrapper** (lines 4120-4123, 11045-11064): Wrap the entire `serve` handler in an outer try/catch that guarantees CORS headers even on catastrophic crashes (e.g., req.clone() failure, env var missing).

2. **Early tripId extraction** (after line 4125): Clone the request early and peek at `tripId` before auth checks. Store as `earlyTripId`. Use it as fallback in the catch block (line 11050) since `params` may be undefined if the error occurred before line 4188.

3. **Fix catch block** (line 11050): Replace `typeof params === 'object' && params?.tripId` with `(typeof params !== 'undefined' && params?.tripId) || earlyTripId`. Recreate supabase client in catch since it may be out of scope.

**File 2: `src/components/planner/shared/GenerationAnimation.tsx`**

4. **SVG pulse rings** (lines 57-70): Replace `animate={{ r: [52, 72] }}` with `animate={{ scale: [1, 72/52] }}` and add `style={{ transformOrigin: '100px 100px' }}`. Same for the second pulse ring and the background glow circle.

**File 3: `src/lib/realtimeSubscriptionManager.ts`**

5. **Increase retry tolerance** (lines 37-38): Change `MAX_RETRY_ATTEMPTS` from 3 to 10 and `BRIEF_DISCONNECT_MS` from 5000 to 30000. Generation can take 2-5 minutes; 3 retries with 5s threshold is too aggressive.

### Files Changed: 3
1. `supabase/functions/generate-itinerary/index.ts` — Global CORS catch, early tripId, improved error recovery
2. `src/components/planner/shared/GenerationAnimation.tsx` — Scale transform instead of r attribute animation
3. `src/lib/realtimeSubscriptionManager.ts` — Increase retry attempts and disconnect threshold

