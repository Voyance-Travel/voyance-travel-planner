
The published error is still consistent with a frontend render-time `.toLowerCase()` on a missing value, but the important clue is this: the stack is still coming from the same published bundle `index-SuNP7A_H.js`, and the database has no corresponding `client_errors` rows. That strongly suggests the live site is still serving an older/cached frontend build, so some of the guards already present in the repo are not yet what users are executing.

What I confirmed in the code:
- `ErrorBoundary` is already enhanced to capture `componentStack`, `failing_component`, route, and tag `toLowerCase` crashes.
- The previously planned guards already exist in:
  - `EditActivityModal`
  - `ImportActivitiesModal`
  - key `EditorialItinerary` spots like `budgetTier`, `d.city`, and `carrier`.
- The codebase still contains additional unguarded high-risk calls in `EditorialItinerary` that can crash when itinerary data is partially missing:
  - `newMode.toLowerCase()` in transport-edit fallback logic
  - `arrivingCity.cityName.toLowerCase()`
  - `destination.toLowerCase()` in destination safety / entry / transfer helper sections

Most likely cause
1. The published site is still on a stale cached bundle.
2. If publishing alone does not clear it, there are still a few remaining unguarded `EditorialItinerary` calls that can produce the exact same runtime error on incomplete trip data.

Implementation plan
1. Harden the remaining high-risk `EditorialItinerary` calls:
   - Guard all `newMode.toLowerCase()` usages with `(newMode || '').toLowerCase()`
   - Guard `arrivingCity.cityName` with `(arrivingCity.cityName || '').toLowerCase()`
   - Guard all `destination.toLowerCase()` usages with `(destination || '').toLowerCase()`
2. Add lightweight breadcrumb metadata around the key `EditorialItinerary` helper blocks that still do string normalization so future crashes tell us which section failed.
3. Verify the client logging path is triggered for render crashes on published routes by checking that `client_errors` receives rows after deployment.
4. Publish/update the frontend so the new bundle replaces `index-SuNP7A_H.js` in production and clears the stale cached path.

Files to update
- `src/components/itinerary/EditorialItinerary.tsx`
- possibly `src/utils/logClientError.ts` only if we want one extra breadcrumb field normalization, but most logging is already in place

Expected result
- The remaining realistic `.toLowerCase()` crash points in the itinerary renderer are removed.
- The next published build should either eliminate the white-screen crash or give much better diagnostics tied to the exact render section.
- If the live site still reports `index-SuNP7A_H.js` after publish, that would confirm a cache/service-worker rollout issue rather than just missing null guards.

Technical notes
- I would focus on `EditorialItinerary` first rather than broad repo-wide cleanup, because the current stack shape and prior fixes point there.
- I would not change backend/database schema for this issue.
- The current absence of `client_errors` records means logging is not yet proving useful in production because the newer frontend bundle is probably not the one executing.
