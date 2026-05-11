Pattern confirmed: current `trackCost(actionType, model, opts?)` supports Pattern B via `costTracker.setUserId(userId)` and `costTracker.setTripId(tripId)`. It does not currently support Pattern A constructor args. I will use Pattern B and keep the shared tracker contract unchanged unless a specific function exposes a gap.

Implementation plan:

1. Tighten attribution wiring across all 10 paid API functions
   - Confirm every function keeps `parseAuth(req)` and assigns the canonical JWT/service-role value from `auth.userId`.
   - Ensure each `trackCost(...)` instance calls `setUserId(userId)` before any possible `save()`.
   - Ensure each function sets `tripId` from request body where available:
     - `viator-search`, `airport-transfers`, `recommend-restaurants`, `lookup-local-events`, `lookup-travel-advisory`, `nearby-suggestions`: `body.tripId`
     - `viator-availability`, `fetch-reviews`, `flight-status`: `body.tripId` when present
     - `viator-product`: parse body/query once safely and set `body.tripId` when present; avoid the current double-body-read pattern.

2. Fix the actual remaining attribution gaps found in inspection
   - `fetch-reviews` currently authenticates but does not pass `auth.userId`/`tripId` into the lazy Google API cost tracker, so rows can remain orphaned. I will thread `{ actionType: 'fetch_reviews', userId, tripId }` into the Google wrapper call.
   - `recommend-restaurants` currently sets the authenticated user, but later can overwrite it from `body.userId`; I will remove that override so client-supplied `userId` cannot replace canonical auth attribution.
   - `viator-product` currently sets userId but does not read or set `tripId`; I will support optional `tripId` from body while preserving query-string product lookup.

3. Verification commands after edits
   - Run `rg -n "trackCost\(|setUserId|setTripId"` across the 10 files to confirm each `trackCost` path has adjacent user attribution.
   - Run a focused search for risky overrides like `if (userId) costTracker.setUserId(userId)` in those files and remove any client-body user attribution.
   - Check `fetch-reviews` no longer relies on lazy un-attributed Google wrapper tracking.

4. Deploy and post-deploy verification
   - Deploy the changed edge functions.
   - Run the 1-hour orphan-rate query after deploy traffic is available. If no rows exist yet in the last hour, report that live attribution has no sample yet and provide the exact query to rerun after traffic.

5. Memory update
   - Create/update `mem://constraints/security/edge-function-auth-required` with the rule: every paid-API edge function must call `trackCost` with canonical `userId` and request `tripId` where present, using Pattern B (`trackCost(...); tracker.setUserId(userId); if (tripId) tracker.setTripId(tripId);`).
   - Add it to the memory index so future work picks it up.