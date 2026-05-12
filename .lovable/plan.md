I checked the current code directly: `src/components/booking/RestaurantLink.tsx` now does contain a 5-second `window.setTimeout` fallback at lines 96–103 and clears it on cleanup at lines 105–108.

That means the current problem is likely not “the timeout code is absent” anymore; it is one of these:

1. The preview/published runtime is not serving the same code the editor now shows.
2. The spinner you still see is coming from another component or another loading state, not this `RestaurantLink` instance.
3. The timeout exists but is mounted after `lookupUrl()` starts, leaving a small race/clarity issue and making the fix harder to trust.
4. The component remounts/retries repeatedly, so each 5-second timeout resolves but a new loading cycle starts immediately.

Plan:

1. Harden `RestaurantLink.tsx` so the deadline is established before the async lookup begins, resets `isLoading`/`url` at the start of each lookup, and clears the timeout when the async call settles.
2. Add a tiny dev-only diagnostic log for timeout expiry and lookup completion so we can distinguish “timeout fired” from “component remounted” without noisy production logs.
3. Inspect the call sites in `InlineBookingActions.tsx` to confirm no parent key/prop churn is repeatedly remounting `RestaurantLink` during itinerary rendering.
4. If prop churn exists, stabilize the props or rendering condition so the timeout can actually resolve the visible spinner once.
5. Verify with a targeted search that `RestaurantLink.tsx` contains the timeout and cleanup, then run a focused test or runtime check rather than relying on stale claims.