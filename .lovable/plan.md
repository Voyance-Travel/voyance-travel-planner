## Problem

Activity Concierge sheet returns "Sorry, I couldn't process that request. Invalid token" on cards (e.g. Lunch at Azul Histórico).

Tracing:
- `src/hooks/useActivityConcierge.ts` correctly sends `Bearer ${session.access_token}` (not the publishable key).
- `supabase/functions/activity-concierge/index.ts` validates the token via `authClient.auth.getUser(token)` and returns the literal string `"Invalid token"` when that call errors.
- `supabase/config.toml` has `verify_jwt = false` for this function, so the platform doesn't pre-validate — the in-code `getUser` is the sole gate.

Root cause: the client picks up an **expired / near-expired** access token from `getSession()` and doesn't refresh it before calling the edge function. `getSession()` returns the cached token even when it's stale (auto-refresh only fires on a timer; long-idle tabs / sheets opened well after navigation hit a stale token). The edge function then rejects it with the generic "Invalid token" message.

## Fix

**`src/hooks/useActivityConcierge.ts`** (the only file changed):

1. Replace the bare `supabase.auth.getSession()` block with a helper that:
   - Calls `getSession()`.
   - If no session → keep the existing "Please sign in to chat with the concierge." path.
   - If `session.expires_at` is within 60s of now (or already past) → call `supabase.auth.refreshSession()` and use the refreshed token. If refresh fails → show "Your session expired. Please refresh the page and try again."
   - Otherwise use the existing token.

2. On a `401` response from the edge function (defensive — refresh race), perform a one-shot `supabase.auth.refreshSession()` and retry the fetch exactly once with the new token. If the retry also returns 401, surface the friendlier "Your session expired. Please refresh the page and try again." message instead of the raw "Invalid token" string.

**`supabase/functions/activity-concierge/index.ts`**:

3. Add a `console.warn("activity-concierge auth failed:", authError?.message, "token_prefix:", token.slice(0,8))` line right before the 401 return so future regressions show the actual reason (expired_token, jwt malformed, signature mismatch, …) in edge logs without leaking the token. No behavior change — still returns `{ error: "Invalid token" }` to the client.

No other files, no auth/business-logic changes, no schema changes.

## Verification

1. Open an itinerary card → AI Concierge sheet → send a message immediately → streams normally.
2. Leave the tab idle for >1h (token expires after 1h by default), open the concierge sheet, send a message → hook auto-refreshes, request succeeds (no "Invalid token").
3. If refresh genuinely fails (e.g. signed out in another tab) → message reads "Your session expired. Please refresh the page and try again." instead of the cryptic "Invalid token".
4. Check `supabase functions logs activity-concierge` after a forced bad token → see the new `auth failed: …` diagnostic line.
