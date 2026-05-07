## What’s actually happening

- The repeated “A listener indicated an asynchronous response…” console messages are Chrome extension/runtime noise. They are not the itinerary failure.
- The itinerary is failing because the backend starts `generate-trip`, then its internal self-call to `generate-trip-day` is being rejected as unauthorized: `Auth getUser failed: invalid claim: missing sub claim`.
- That leaves the trip stuck in `generating`, so the UI never gets a completed itinerary.
- The SVG `<circle>` warnings are separate: at least one animated/progress SVG can render `cx`, `cy`, or `r` as `undefined` in the deployed bundle. This should be guarded so warnings don’t mask real generation errors.

## Plan

1. **Fix backend self-chaining authorization**
   - Update `generate-itinerary` auth handling so service-role internal calls are recognized before normal user JWT validation.
   - Keep the existing whitelist, but make sure all legitimate internal chain actions are covered: `generate-trip`, `generate-trip-day`, `generate-day`, and `regenerate-day`.
   - Add `apikey` to internal chain fetch headers where missing, matching the rest of the function’s internal calls.

2. **Make generation failure visible instead of stuck**
   - If the initial self-chain launch returns a non-2xx response after retries, mark the trip as `failed` and persist a clear `chain_error` in trip metadata.
   - Return a clear error payload to the frontend instead of reporting “generating” when the chain never started.

3. **Guard the SVG circle renderer**
   - Harden the loading/progress SVG component(s) so `cx`, `cy`, and `r` are always finite numbers before rendering.
   - Clamp progress and completion values to safe numeric ranges.

4. **Validate**
   - Run the focused edge-function tests if present.
   - Deploy/test `generate-itinerary` with the affected trip path and confirm the backend no longer logs `missing sub claim` for internal chain calls.
   - Confirm the trip transitions out of stuck `generating` into either active progress or a clear failed state.

## Files likely touched

- `supabase/functions/generate-itinerary/index.ts`
- `supabase/functions/generate-itinerary/action-generate-trip.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` if any chain header path is inconsistent
- `src/components/planner/shared/GenerationAnimation.tsx` and possibly `src/components/common/PreferenceNudge.tsx` / `src/components/trips/ActiveTripStats.tsx` for SVG guards