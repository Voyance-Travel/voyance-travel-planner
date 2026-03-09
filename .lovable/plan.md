

## Plan: Fix Route Details — Google API Returns Error

### Root Cause
I tested the `route-details` edge function directly. It's deployed and responding (200), but Google Maps Directions API is returning a non-OK status. The response is `{ steps: [], summary: "Route not available" }`. The function doesn't log or return the Google API status/error, making it impossible to debug.

The frontend code is correct — it calls `fetchRouteDetails` on option expand, receives empty steps, and falls back to generic route text. **This is a backend issue, not a frontend issue.**

### Changes

#### 1. Update `supabase/functions/route-details/index.ts`
Add logging and return the Google API status in error responses so we can debug:

- **Add `console.log`** for the Google API response status and error message
- **Return `googleStatus`** in the error response so frontend can log it
- **Handle `departure_time` correctly** — `departure_time: 'now'` is only valid for `driving` and `transit` modes, not `walking`. For walking mode, omit it.
- **Make `mode` optional** — default to `'transit'` if not provided (the current code returns 400 if mode is missing, but the frontend may send without it)

The key fix: the `departure_time=now` parameter may be causing `INVALID_REQUEST` for walking mode. The Google Directions API docs state `departure_time` is only valid for driving and transit.

#### 2. No frontend changes needed
The `TransitModePicker` already:
- Calls `fetchRouteDetails` on Level 2 expand (line 280)
- Renders step-by-step directions when `routeDetailsCache` has data (lines 492-521)
- Falls back to generic route text when no steps available (lines 523-538)
- Shows loading spinner while fetching (lines 485-489)

Once the edge function returns actual steps, the UI will render them automatically.

### Technical Details

Updated edge function will:
1. Default `mode` to `'transit'` if omitted
2. Only include `departure_time` for driving/transit, not walking
3. Log Google API response status
4. Return `googleStatus` and `error_message` in error responses for debugging

