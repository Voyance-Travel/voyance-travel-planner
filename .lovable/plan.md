# Stabilize the restaurant link lookup

## What the user is seeing

Three dining cards (L'Entrecôte Day 2, Blend Gourmet Burger Day 3, Basmane Day 4) render with a stuck spinner reading "Loading… / Finding restaurant…" instead of resolving to either a "View Restaurant" link or no link at all. This is the small affordance under each dining card produced by `RestaurantLink` (in `InlineBookingActions` → `find_restaurant` branch), which calls the `lookup-restaurant-url` edge function (Perplexity sonar).

## Root cause

The previous fix added a 5s client-side deadline so a hung invoke would resolve to `null` and the link would simply hide. That works in isolation, but the dining card is re-mounted frequently by upstream re-renders (cascade preview rebuilds, `TRIP_PERSISTED_EVENT` resync, financial snapshot updates). When the parent remounts before 5s elapses:

- The cleanup fires (`cancelled = true`), the in-flight invoke is abandoned, and **nothing is written to `urlCache`**.
- The next mount starts the spinner over and re-fires Perplexity from scratch.
- For lesser-known names (Basmane, regional Blend Gourmet Burger) Perplexity often takes >5s, so we never persist a result.

Net effect: a permanent "Finding restaurant…" UI for any name slow enough that no single mount survives long enough to cache it. Edge-function logs over the affected window show zero successful invocations of `lookup-restaurant-url` for the trip — confirming the request never completes from the user's vantage point.

A secondary contributor: even when Perplexity does eventually respond, the server has no upper bound, so a 12s response wastes credits and still misses the client deadline.

## Fix

Make the lookup survive remounts and fail closed silently.

### 1. Module-scoped in-flight dedupe + survival (`src/components/booking/RestaurantLink.tsx`)

- Add `inflight: Map<string, Promise<string | null>>` next to `urlCache`.
- `lookupUrl()` checks `inflight` first; if a promise exists for `cacheKey`, await it instead of starting a new invoke.
- The promise itself (not the component) writes the final result to `urlCache`. So even if every subscriber unmounts, the result still lands in cache and the next mount short-circuits.
- Cleanup only flips a local `cancelled` flag for `setState`; it never aborts the underlying fetch.

### 2. Negative cache on deadline + sessionStorage persistence

- When the 5s deadline fires, immediately `urlCache.set(cacheKey, { url: null })` so subsequent mounts in this session don't re-fire the same lookup.
- Mirror `urlCache` into `sessionStorage` (key `restaurantUrlCache:v1`) so a hard refresh inherits known-null entries instead of re-spinning.

### 3. Render no spinner after a short grace period

The spinner itself is the visible bug. Replace the always-on "Finding restaurant…" with:

- 0–1200 ms: render `null` (no UI). Most cache hits and fast lookups resolve in this window.
- After 1200 ms still loading: still render `null` (silent). The lookup keeps running in the background and updates `urlCache`; on the next render (or remount) the link appears if found.

This eliminates the stuck-spinner regression by construction. If Perplexity finds the URL we still get the link; if it doesn't, the card looks the same as one with no link (which is already the post-deadline state).

### 4. Server-side hardening (`supabase/functions/lookup-restaurant-url/index.ts`)

- Wrap the Perplexity `fetch` in an `AbortController` with an 8s timeout.
- On abort or non-OK response, persist `setCache(cacheKey, 'restaurant_url', { url: null }, TTL.THIRTY_DAYS)` so we don't keep paying Perplexity for the same miss.
- Keep the existing 30-day positive cache.

### 5. One-line guard against name churn

`InlineBookingActions` line 413 passes `activity.location?.name || activity.title`. Memoize the chosen name with `useMemo` so referential changes in the activity object don't churn the `RestaurantLink` `useEffect` deps. (Strings compare by value, but this also catches `undefined → ''` flips during snapshot rebuilds.)

## Verification

- Add `src/components/booking/__tests__/RestaurantLink.dedupe.test.tsx`:
  - Mounting twice with the same name fires `supabase.functions.invoke` exactly once.
  - Unmounting before resolution still writes `urlCache`; next mount reads from cache without invoking.
  - Deadline timeout writes a null entry to cache; subsequent mount returns `null` synchronously.
- Add `supabase/functions/lookup-restaurant-url/__tests__/index.test.ts` (or extend if present): a stalled Perplexity (mock `fetch` that never resolves) returns `{ success: true, url: null }` within 8.5s and the cache is populated.
- Manually re-load the Casablanca trip and confirm none of the three dining cards show the spinner; either a link appears or the affordance is absent.

## Files touched

- `src/components/booking/RestaurantLink.tsx` — dedupe, sessionStorage cache, silent loading state.
- `src/components/booking/InlineBookingActions.tsx` — `useMemo` on resolved restaurant name (one-liner).
- `supabase/functions/lookup-restaurant-url/index.ts` — 8s `AbortController`, cache nulls on abort/error.
- New tests as listed above.
- Memory: append a one-liner under `mem://constraints/itinerary/...` (new file `restaurant-link-lookup-stability`) and reference from `mem://index.md`.

## Out of scope

- The dining card's main copy ("Loading restaurant info…" headers, descriptions) — that's served by a different pipeline (`_shared/description-fill.ts`) and is unrelated to the `RestaurantLink` spinner. The user's "descriptions" wording refers to this small under-card affordance, confirmed by the exact strings cited.
