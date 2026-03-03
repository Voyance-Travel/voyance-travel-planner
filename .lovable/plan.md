

# Fix Invite Accept — 4 Surgical Changes

## Overview
Four targeted changes to make invite acceptance robust against double-clicks, stale auth tokens, and concurrent race conditions. No refactoring, no changes to `resolve_or_rotate_invite` or group budgets flow.

---

## Change 1: Double-call guard (AcceptInvite.tsx)

Add a `useRef(false)` guard to `handleAccept` to prevent React StrictMode and rapid double-clicks from firing multiple RPC calls.

- Add `import { useRef }` and create `acceptingRef = useRef(false)` at component level
- Guard at top of `handleAccept`: `if (acceptingRef.current) return;` then set to `true`
- Wrap existing try/catch in a `finally` that resets `acceptingRef.current = false`
- Update button `disabled` prop: `disabled={accepting || acceptingRef.current}`

## Change 2: Auth token readiness (AcceptInvite.tsx)

Before calling the `accept_trip_invite` RPC, verify the session is valid. If not, redirect to sign-in with a return path.

- Add `import { guardedGetSession } from '@/lib/authSessionGuard'` (already exists in codebase)
- Before the RPC call inside `handleAccept`, await `guardedGetSession()`
- If no valid session, call `redirectToInviteAuth('signin')` and return early

## Change 3: Structured error logging (AcceptInvite.tsx)

Replace the generic `logger.error('[invite] Accept error:', err)` in the catch block with structured field extraction (`message`, `code`, `details`, `hint`, `status`).

## Change 4: Row-level lock on invite (SQL migration)

Update the `accept_trip_invite` RPC to add `FOR UPDATE` to the invite SELECT, serializing concurrent accept calls and preventing double-increment of `uses_count`.

Single line change:
```sql
-- Before:
SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token;
-- After:
SELECT * INTO v_invite FROM public.trip_invites WHERE token = p_token FOR UPDATE;
```

The full RPC will be re-created in a new migration with this one change. All other logic remains identical.

---

## Files Modified
- `src/pages/AcceptInvite.tsx` — Changes 1, 2, 3
- New migration SQL file — Change 4

## What is NOT touched
- `resolve_or_rotate_invite` RPC
- `group_budgets` / "Enable Group Editing" flow
- Auth system / lock warnings
- Invite validation/display logic

