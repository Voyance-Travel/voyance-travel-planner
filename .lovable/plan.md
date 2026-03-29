
Fix this in three layers, because we now know it is not just “one missed null guard”.

## What I found

1. The crash is still plausibly coming from the trip-detail render tree, because there are still several unguarded runtime `.toLowerCase()` calls in itinerary-related components beyond the first batch we fixed.
2. Your client-side logging gap is real: `useErrorTracker()` writes unhandled browser errors to `client_errors`, but `ErrorBoundary.componentDidCatch()` only writes to `console.error`. So React render crashes can show the “Small detour” screen without being persisted to your logs.
3. The “weird Small detour graphic” is not what the current code contains anymore. `src/components/common/ErrorBoundary.tsx` already has a clean exclamation-circle SVG. If production still shows the old/broken visual, the published client is likely serving a stale cached PWA bundle.

## Implementation plan

### 1. Close the logging blind spot for React render crashes
Update the error handling path so React boundary failures are stored in the backend, not just printed to console.

- Extract the existing `client_errors` insert logic from `useErrorTracker.ts` into a shared helper.
- Call that helper from:
  - `useErrorTracker()` for window errors / unhandled rejections
  - `ErrorBoundary.componentDidCatch()` for React render crashes
- Include metadata such as:
  - route
  - component stack
  - error message / stack
  - build/version marker if available
  - source = `error_boundary` vs `window_error`

Result: if this happens again, you’ll see the exact frontend failure in `client_errors` instead of only in browser console.

### 2. Finish the defensive rendering pass in the actual failing trip-detail path
Apply function-level guards to the remaining likely crash points we found.

Highest-priority files:
- `src/components/booking/RestaurantLink.tsx`
  - `getCacheKey(name, destination)` currently does `name.toLowerCase()` / `destination.toLowerCase()` with no runtime guard
  - this is a strong candidate because `InlineBookingActions` can still pass a missing activity title into `RestaurantLink`
- `src/components/itinerary/TransitModePicker.tsx`
  - guard `activityTitle.toLowerCase()`
  - guard `option.mode.toLowerCase()` / `option.label.toLowerCase()`
  - guard helper `getModeIcon(mode)`
- `src/components/itinerary/TransitGapIndicator.tsx`
  - guard `prevDuration.toLowerCase()`
  - guard `method.toLowerCase()`
  - keep category guard pattern consistent
- `src/components/itinerary/WeatherForecast.tsx`
  - guard `condition.toLowerCase()`
  - guard `d.condition.toLowerCase()`
- `src/components/itinerary/EditorialItinerary.tsx`
  - replace repeated direct `.toLowerCase()` calls with already-normalized locals where possible
  - make every title/category/type-derived string fallback to `''` or `'activity'` before normalization

Preferred approach:
- add a tiny shared helper like `safeLower(value: unknown): string`
- use it in render-critical code instead of ad hoc string assumptions

Result: malformed itinerary data won’t crash the page even if titles/categories are missing.

### 3. Make the “Small detour” UI deterministic
Even though the repo already shows the corrected icon, I’d harden this anyway so the fallback can’t look corrupted again.

- Replace the inline SVG in `ErrorBoundary` with a standard Lucide icon component (for example `AlertCircle`)
- Keep the fallback UI minimal and dependency-light
- Optionally add a tiny error code / “reload app” hint so support can identify boundary hits faster

Result: the fallback screen becomes visually reliable and easier to recognize.

### 4. Fix the stale published bundle / PWA cache risk
Because the code and the production visual appear out of sync, address the publishing cache path directly.

- Review the PWA/service worker behavior in:
  - `src/main.tsx`
  - `vite.config.ts`
- Add a one-time stale-cache recovery path for published clients, for example:
  - force service worker update more aggressively
  - clear outdated caches on version mismatch
  - or temporarily disable the PWA worker until the app is stable again
- Ensure new deployments cannot keep serving an old boundary UI bundle after refresh

Result: when a fix is deployed, users actually get the fix.

### 5. Add regression coverage so this does not repeat silently
Add targeted tests for the exact failure class.

#### Unit/component coverage
Render these components with incomplete data:
- `InlineBookingActions`
- `RestaurantLink`
- `TransitModePicker`
- `TransitGapIndicator`
- `WeatherForecast`
- key `EditorialItinerary` activity-row helpers

Test data should include:
- missing `title`
- missing `category`
- missing `type`
- missing weather condition
- missing transport mode/label

#### End-to-end smoke coverage
Add a critical-path test that:
- opens a trip with sparse/malformed itinerary items
- confirms the page renders instead of hitting the boundary
- verifies `client_errors` receives entries when a forced boundary error is triggered in test mode

#### Publish verification
After deploy, explicitly verify:
- published site serves the latest asset hash
- boundary icon matches current code
- hard refresh/new session no longer shows old fallback art

## Expected outcome

After this pass:
- the page should stop crashing on missing string fields
- React render crashes will finally be visible in your backend logs
- the “Small detour” screen will render consistently
- published fixes won’t be masked by stale PWA/cache behavior

## No database schema changes needed
This should be code-only. The existing `client_errors` table is already in place; it just isn’t being used by `ErrorBoundary`.
