
I inspected the current code and the new error report. The strongest conclusion is that this is now a two-part issue: one remaining render-time string guard gap in `EditorialItinerary`, plus a stale frontend bundle problem caused by PWA/service-worker caching.

What I confirmed
- The published crash still points to the same old bundle hash: `index-SuNP7A_H.js`.
- The app still has PWA enabled in `vite.config.ts` via `vite-plugin-pwa`.
- `src/main.tsx` tries to clear caches manually, but that does not reliably prevent an already-installed service worker from serving stale assets.
- `client_errors` is receiving other frontend inserts, so logging works in general; the absence of recent render-crash rows points to users still executing an older cached build.
- Several previously targeted `EditorialItinerary` guards are already present.
- One additional unguarded high-risk path still exists in `EditorialItinerary.tsx`:
  - `category.toLowerCase()`
  - `title.toLowerCase()`
  inside the cost-estimation helper around lines `1036-1043`

Plan
1. Harden the remaining render-time gap in `EditorialItinerary`
   - Replace direct `category.toLowerCase()` and `title.toLowerCase()` with defensive normalization.
   - Prefer the existing `safeLower()` helper so the pattern is consistent with the project’s defensive rendering strategy.

2. Remove the stale-bundle source for frontend deploys
   - Disable the PWA plugin in `vite.config.ts` for now, since this app is actively suffering from stale published bundles.
   - Keep the app installability/offline discussion separate; for this bug, reliability matters more than caching.

3. Clean up startup behavior in `src/main.tsx`
   - Remove the ad-hoc service worker update / cache purge block once PWA is disabled.
   - If desired, replace it with a small unregister routine for existing service workers on load so old clients stop using stale caches.

4. Preserve diagnostics
   - Keep `ErrorBoundary`, `GlobalErrorHandler`, and `useErrorTracker` as-is.
   - Optionally add one breadcrumb field to the itinerary render helper if you want future `client_errors` rows to identify the failing itinerary section more precisely.

Files to update
- `src/components/itinerary/EditorialItinerary.tsx`
- `vite.config.ts`
- `src/main.tsx`
- optionally `src/utils/logClientError.ts`

Expected result
- The remaining realistic `.toLowerCase()` render crash in the itinerary renderer is removed.
- New frontend publishes should stop serving the stale `index-SuNP7A_H.js` bundle.
- Future crashes, if any, should come from the current build and be much easier to diagnose.

Technical details
- Current confirmed unguarded code:
  - `src/components/itinerary/EditorialItinerary.tsx:1036-1043`
- Current confirmed PWA source:
  - `vite.config.ts:22-61`
- Current manual cache logic:
  - `src/main.tsx:72-93`

Implementation note
- I would treat disabling PWA/service-worker caching as part of this fix, not as a separate cleanup. The repeated old asset hash is too consistent to ignore.
