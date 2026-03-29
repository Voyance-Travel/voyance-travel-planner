

# Plan: Enhance Error Logging to Diagnose the `.toLowerCase()` Crash

## The Problem With Current Logging

The `client_errors` table has **zero records** of the `.toLowerCase()` crash. Here's why:

1. **Production is serving a stale bundle.** The error comes from `index-SuNP7A_H.js` — a cached production asset. Your code changes (guards, ErrorBoundary logging) exist in the repo but have **not reached the user's browser** yet. The PWA cache or CDN is still serving the old JS bundle.

2. **Even when deployed, the logging is incomplete.** The `logClientError` call in `ErrorBoundary.componentDidCatch` does not capture enough to trace the crash to a specific function. The minified stack (`Lat`, `XR`, `AQ`) is useless without a source map. The `componentStack` from React only shows the component tree, not which internal function called `.toLowerCase()`.

## What Needs to Change

### 1. Force the stale cache out (highest priority)
The cache-busting code added to `main.tsx` exists in the repo but hasn't reached production. Until the user's browser loads the new bundle, no new logging will fire. We need to:
- **Publish the app** so the new code reaches the CDN
- Add a `<meta>` cache-control header in `index.html` to prevent aggressive caching of the HTML shell
- Ensure the service worker `skipWaiting()` + `clients.claim()` is working in `vite.config.ts` PWA config

### 2. Add source maps for production builds
Without source maps, the minified stack (`Lat at line 2615:49429`) is untraceable. We should:
- Enable `build.sourcemap: 'hidden'` in `vite.config.ts` (generates `.map` files but doesn't expose them to browsers)
- Or enable `build.sourcemap: true` temporarily to decode the crash

### 3. Enrich the ErrorBoundary log with the failing component name
Currently `componentDidCatch` logs `componentName: 'ErrorBoundary'` — that's the boundary itself, not the component that crashed. We should:
- Parse the React `componentStack` to extract the first (deepest) component name
- Log it as `failing_component` in the metadata
- Add the `error.message` verbatim so we can filter by "toLowerCase"

### 4. Add a breadcrumb trail for the render path
Since 249 `.toLowerCase()` calls exist in `EditorialItinerary.tsx` alone, we need to narrow down which function crashes. Add a lightweight breadcrumb system:
- Before each major render function in EditorialItinerary, push a breadcrumb string (e.g. `'estimateActivityCost'`, `'resolveTransportMode'`)
- On crash, include the last breadcrumb in the error metadata
- This is zero-cost in the happy path (just a variable assignment)

### 5. Guard the remaining 3 unguarded `.toLowerCase()` calls
While the logging improvements will help future diagnosis, we should also fix the known remaining unguarded calls:

| File | Line | Unguarded call |
|------|------|----------------|
| `EditorialItinerary.tsx` | 950 | `budgetTier.toLowerCase()` |
| `EditorialItinerary.tsx` | 1755 | `d.city.toLowerCase()` and `cityName?.toLowerCase()` |
| `EditorialItinerary.tsx` | 1781 | `carrier.toLowerCase()` |

These are strong crash candidates — `budgetTier`, `d.city`, and `carrier` can all be undefined.

## Files to Change

| File | Change |
|------|--------|
| `index.html` | Add `<meta>` no-cache for HTML shell |
| `vite.config.ts` | Enable hidden source maps; verify PWA `skipWaiting` config |
| `src/utils/logClientError.ts` | Add `failing_component` extraction from componentStack |
| `src/components/common/ErrorBoundary.tsx` | Parse componentStack for deepest component; include in metadata |
| `src/components/itinerary/EditorialItinerary.tsx` | Guard lines 950, 1755, 1781; add render breadcrumbs to major functions |

## Expected Outcome

After publishing:
1. Users get the new bundle (cache-busted)
2. If the crash still occurs, `client_errors` will contain the exact component, breadcrumb trail, route, and (with source maps) a readable stack trace
3. The 3 remaining unguarded calls are fixed, which may eliminate the crash entirely

