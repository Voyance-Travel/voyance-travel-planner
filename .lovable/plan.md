## Fix 1.2 — Differentiate share-lookup error states

### Goal
Replace the single opaque `"Trip not found or sharing is disabled"` response from `get_consumer_shared_trip` with three typed reasons, and render distinct copy for each on the public share page.

### Reasons returned

| `error_code`        | When                                                                                  | UI copy                                                  |
|---------------------|---------------------------------------------------------------------------------------|----------------------------------------------------------|
| `token_not_found`   | No `trips` row matches `share_token = p_share_token`                                  | "This share link is invalid."                            |
| `sharing_disabled`  | Row matches the token but `share_enabled = false`                                     | "The trip owner turned off sharing for this link."       |
| `trip_unavailable`  | Row matches and is enabled, but `itinerary_data->'days'` is null/empty (race window)  | "Trip is loading — try again in a moment."               |

### Changes

**1. New migration: redefine `public.get_consumer_shared_trip`**
- Split the lookup into two queries:
  - `SELECT … WHERE share_token = p_share_token` → if no row, return `{error_code: 'token_not_found', error: 'This share link is invalid'}`.
  - Then check `share_enabled` → if false, return `{error_code: 'sharing_disabled', error: 'Sharing has been turned off for this link'}`.
- After sanitizing days, if the resulting array is empty AND the trip has no `itinerary_data->'days'`, return `{error_code: 'trip_unavailable', error: 'Trip is still being prepared'}`.
- Successful payloads are unchanged (no `error`/`error_code` keys).
- Re-grant `EXECUTE … TO anon, authenticated` (idempotent — preserves anon access).

**2. `src/pages/ConsumerTripShare.tsx` (lines 86–151)**
- Keep existing `errorCode` state.
- In the error render block, replace the current 2-way `isPaused` branch with a 3-way switch on `errorCode`:
  - `token_not_found` → heading "Trip Not Found", copy "This share link is invalid.", CTA "Plan Your Own Trip" → `/`.
  - `sharing_disabled` → heading "Sharing Paused", copy "The trip owner turned off sharing for this link.", no CTA, hint "Ask the trip owner for a new link".
  - `trip_unavailable` → heading "Almost Ready", copy "Trip is loading — try again in a moment.", CTA "Retry" that re-runs `fetchTrip()`.
  - Default (network/RPC throw) → current generic fallback.
- Catch-block fallback keeps `errorCode = null` → falls into default branch.

**3. `src/services/publicShareLink.ts`**
- Extend `getPublicShareErrorMessage` with the three new cases (`token_not_found`, `sharing_disabled`, `trip_unavailable`) so any other caller using this helper renders consistent copy.

### Out of scope
- Toggle-side readiness check (Fix 1.3) — separate plan item.
- Changing the sanitization whitelist or success payload shape.
- Editing the original `20260406115126` migration (new migration only, per instruction).

### Validation
- Manual: hit `/trip-share/<bogus>` → "invalid"; toggle off + revisit → "paused"; brand-new trip with empty `itinerary_data` shared → "loading, retry"; valid enabled trip → renders normally.
- DB: confirm `anon` retains `EXECUTE` on the redefined function (`pg_proc` + `pg_acl`).
