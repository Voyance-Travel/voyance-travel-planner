## Problem

Frontend shows `Initial chain failed (status=401)`. That string is written by `action-generate-trip.ts` (line 770) when its self-`fetch` to `generate-itinerary` (action `generate-trip-day`) returns 401.

The receiver (`generate-itinerary/index.ts`) only returns 401 in one place: the user-auth fallback (line 161), which means the **service-role bypass at line 122 evaluated to false**, even though the caller sent `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` from the same env it just read.

Most likely causes (signing-key / new API-key rollout):
1. `SUPABASE_SERVICE_ROLE_KEY` is now a non-JWT secret (e.g. `sb_secret_...`). `decodeJwtRole()` returns null, and `bearerToken === supabaseKey` should still be true — UNLESS one side trims/encodes differently or the value is empty/undefined in one invocation.
2. The two function instances briefly read different env values during a rotation.
3. `req.headers.get('Authorization')` arrives lowercased / re-cased by the platform, and our `.replace('Bearer ', '')` misses a `bearer ` (lowercase) prefix.

We need observability before guessing, then a robust auth path that does not depend on string-equality of a rotating secret.

## Plan

### 1. Add diagnostic logging in the receiver (no behavior change yet)

In `supabase/functions/generate-itinerary/index.ts` around the `isServiceRoleCall` block, log (without leaking the secret):
- `bearerToken.length`, first 6 chars, last 4 chars
- `supabaseKey.length`, first 6 chars, last 4 chars
- `bearerToken === supabaseKey`
- `decodeJwtRole(bearerToken)`
- raw `Authorization` header prefix (first 10 chars)
- `peekBody.action`, `peekBody.userId` presence

Deploy, trigger one Venice generation, read logs to confirm root cause.

### 2. Replace fragile equality check with a dedicated internal shared secret

Stop relying on `SUPABASE_SERVICE_ROLE_KEY` for self-chain auth. Add a new secret `INTERNAL_CHAIN_SECRET` (random 48-byte hex) and:

- **Caller** (`action-generate-trip.ts`, `action-generate-trip-day.ts`, any other self-chain spots): send headers
  ```
  Authorization: Bearer ${SERVICE_ROLE_KEY}   // keeps platform-level happy
  x-internal-chain-secret: ${INTERNAL_CHAIN_SECRET}
  ```
- **Receiver** (`generate-itinerary/index.ts`): treat the call as service-role if `req.headers.get('x-internal-chain-secret') === Deno.env.get('INTERNAL_CHAIN_SECRET')`. Keep the existing JWT-role/exact-match path as a fallback so existing callers still work during rollout.

This is immune to signing-key rotation, JWT vs. opaque token format changes, and header re-casing.

### 3. Make `decodeJwtRole` and bearer parsing case-insensitive

Tiny hardening:
- Match `^bearer\s+`, case-insensitive, when stripping the prefix.
- Also accept `role: 'service_role'` from a nested `app_metadata` claim shape, if present.

### 4. Identify every self-chain caller

Search the repo for `functions/v1/generate-itinerary` and any `generate-itinerary` self-`fetch` to make sure all of them are updated to send the new header. Currently expected: `action-generate-trip.ts` and `action-generate-trip-day.ts` (day-to-day chaining).

### 5. Surface a clearer error to the user when chain auth fails

If the receiver returns 401 to a self-chain, `action-generate-trip` should:
- Log the response body (already does, line 746) — also log the **caller's** view of `serviceKey.length` / first 6 chars to compare with the receiver log.
- Mark the trip `failed` with `generation_error: 'Internal auth failed — please retry; if it persists, rotate INTERNAL_CHAIN_SECRET.'` instead of the current generic message.

### 6. Verify

- Deploy both files.
- Generate a fresh Venice itinerary.
- Confirm in logs: `Service-role bypass for generate-trip-day, userId: ...` appears, no 401.
- Confirm trip transitions out of `generating` into normal day-by-day progress.

## Files touched

- `supabase/functions/generate-itinerary/index.ts` — diagnostic logs, header-secret bypass, case-insensitive bearer.
- `supabase/functions/generate-itinerary/action-generate-trip.ts` — send `x-internal-chain-secret`, clearer error.
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — same header on day→day chain.
- New secret: `INTERNAL_CHAIN_SECRET` (added via secrets tool after you approve).

## Out of scope

- No frontend changes (the user-facing call still uses the user JWT and is unaffected).
- No image-cache work (already shipped in the previous loop).
