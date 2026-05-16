## Problem

Concierge chat consistently 401s with `Invalid token`. Auth logs show GoTrue `/user` returning `403: invalid claim: missing sub claim` — meaning the JWT reaching `parseAuth` (which calls `supabase.auth.getClaims(token)`) isn't a valid user JWT at the moment of the call.

Two converging root causes:

1. **Client (`src/hooks/useActivityConcierge.ts`)** has its own bespoke token-refresh logic that races with the rest of the app (`getSession` → `refreshSession` is not deduped). Under refresh contention the call can fire with a stale/expired access_token, or with an empty token after a failed refresh.

2. **Server (`supabase/functions/activity-concierge/index.ts`)** uses `parseAuth` → `auth.getClaims(token)`. In the current Lovable Cloud setup `getClaims` falls back to GoTrue `/user`, and any transient JWKS hiccup or millisecond-level expiry produces a hard 401 with no retry path.

## Plan

### 1. Client: use the shared auth guard

In `src/hooks/useActivityConcierge.ts`:
- Replace the local `getFreshToken` with `getValidAccessToken()` from `src/lib/authSessionGuard.ts` (already exists, already deduped + cooldown-gated, already used elsewhere). This eliminates the refresh race that produces empty/stale tokens.
- On a 401 response, call `guardedRefreshSession()` (not `supabase.auth.refreshSession()` directly) before the one-shot retry.

### 2. Server: harden `parseAuth` for the concierge

In `supabase/functions/activity-concierge/index.ts`:
- Keep `parseAuth` as the first check.
- If `parseAuth` returns a `Response` (i.e. `getClaims` failed), do a single fallback: construct a fresh anon client with `global.headers.Authorization = Bearer <token>` and call `supabase.auth.getUser()`. If that returns a user with `id`, treat the request as authenticated. Only return 401 when both paths fail.
- Log which path succeeded with a `[concierge-auth]` sentinel so we can confirm in edge logs whether the regression is JWKS-side or client-side.

This narrow server-side fallback is intentionally scoped to this one function — we are not changing the shared `parseAuth` helper used by 13+ paid endpoints.

### 3. Verify

- Reload the trip page, open concierge on an activity, send "suggest an alternative".
- Confirm in edge logs: `[concierge-auth] ok via=getClaims` (or `via=getUser` fallback) and a 200 stream response.
- Confirm browser console no longer shows `Concierge stream error: Invalid token`.

### Files touched

- `src/hooks/useActivityConcierge.ts` — swap to `getValidAccessToken` + `guardedRefreshSession`.
- `supabase/functions/activity-concierge/index.ts` — add `getUser` fallback after `parseAuth` fails, plus sentinel logs.

### Out of scope

- No changes to `_shared/require-auth.ts` (would affect 13 other paid endpoints).
- No changes to other concierge UI surfaces.
