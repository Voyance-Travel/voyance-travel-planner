
Goal: make invite links reliably survive auth/signup/OAuth redirects and stop returning generic “invite invalid,” while increasing invite link durability.

What I verified in the current codebase
- Frontend currently persists only return paths (`saveReturnPath`) but does not persist a dedicated invite token key.
- `AcceptInvite.tsx` sends users to `/{signin|signup}?redirect=/invite/{token}` but does not include `inviteToken` URL param.
- `SignInForm.tsx` and `SignUpForm.tsx` preserve redirect intent, but the “Create one / Sign in” links between forms currently drop query params, which can lose invite context.
- `OAuthReturnHandler.tsx` only checks `peekReturnPath()` and does not recover invite token from URL params + both storages.
- Backend `accept_trip_invite` already does not block on `accepted_at/accepted_by`, but it returns success for some already-member paths and reason naming can be made more explicit for debugging.
- Backend `resolve_or_rotate_invite` currently sets `max_uses` from traveler capacity (`travelers - 1`), which leads to very low limits (often 1). Live data confirms many invites are `max_uses=1`, which makes links rotate/expire quickly in normal testing flows.

Implementation plan

1) Add dedicated invite token persistence (dual storage + helpers)
- Add a small utility (either in `authReturnPath.ts` or a new `inviteTokenPersistence.ts`) with:
  - `savePendingInviteToken(token)` → writes to both `sessionStorage` and `localStorage`.
  - `peekPendingInviteToken()` → checks session first, then local.
  - `consumePendingInviteToken()` → reads then clears both.
  - `clearPendingInviteToken()`.
  - `extractInviteTokenFromPath(path)` for `/invite/{token}` parsing.
- Keep keys explicit and namespaced (e.g. `voyance_pending_invite_token` + durable key).

2) Thread invite token through auth URLs end-to-end
- In `AcceptInvite.tsx`:
  - Persist token immediately on page load to both storages.
  - Build auth redirects as:
    - `/signin?redirect=/invite/{token}&inviteToken={token}`
    - `/signup?redirect=/invite/{token}&inviteToken={token}`
  - On `requiresAuth` from RPC, redirect with both params again.
- In `SignInForm.tsx` and `SignUpForm.tsx`:
  - Read token from URL param `inviteToken` and/or extract from `redirect`.
  - Persist token on mount (dual storage).
  - Update the link to the opposite auth form to preserve both `redirect` and `inviteToken` so context isn’t dropped during sign-in/sign-up switching.
- In `SocialLoginButtons.tsx`:
  - Persist invite token before OAuth redirect.
  - Preserve invite token in callback path by using redirect URI with query when available (while keeping current custom-domain OAuth strategy intact).

3) Post-auth invite recovery (URL + session + local)
- In `OAuthReturnHandler.tsx`:
  - Recovery priority:
    1) `inviteToken` URL param,
    2) token extracted from saved return path,
    3) token from session storage,
    4) token from local storage.
  - If token found, redirect to `/invite/{token}` first (replace history), then clear consumed token state.
  - If no token found, keep current return-path fallback behavior.
- In email/password success paths (`SignInForm` / `SignUpForm`):
  - After successful auth, run the same token recovery priority before generic `consumeReturnPath(...)`.
  - This ensures invite completion is always prioritized over normal profile redirect.

4) Make AcceptInvite token resolution robust
- In `AcceptInvite.tsx`, resolve active token with fallback order:
  - route param `:token` → `inviteToken` query param → persisted token.
- If route token missing but persisted token exists, normalize by navigating to `/invite/{token}`.
- Keep current reason-based UI mapping, but expand mapping for newly explicit backend reasons where needed.

5) Backend: strengthen reason diagnostics and align invite validity checks
- Create a migration updating `public.accept_trip_invite(p_token text)` to:
  - Return explicit reason codes for each failure path:
    - `token_not_found` (or keep `invalid_token` but make it explicit/consistent),
    - `expired`,
    - `invite_limit_reached`,
    - `already_member`,
    - `trip_full`,
    - `trip_not_found`,
    - `already_owner`,
    - `requires_auth`.
  - Ensure validity is determined only by:
    - token exists,
    - `uses_count < max_uses`,
    - not expired,
    - user not already collaborator.
  - Keep `accepted_at`/`accepted_by` as metadata only (write-only on success), not blockers.
- Optionally align `get_trip_invite_info` reason labels with the same naming convention for consistent frontend diagnostics.

6) Backend: increase max_uses policy and apply to existing invites
- Create migration updating `resolve_or_rotate_invite` formula:
  - from: capacity-based (`travelers - 1`)
  - to: `GREATEST(7, COALESCE(travelers,1) * 2)`.
- Ensure both paths use this:
  - new invite creation,
  - existing invite refresh/upgrades (if existing `max_uses` is lower than new recommended threshold, raise it).
- Apply one-time data update for existing active invites so current shared links don’t stay stuck at low max_uses values.

7) Frontend reason display for debugging
- Update `getErrorDisplay(...)` in `AcceptInvite.tsx` to include any new backend reason keys.
- Preserve user-friendly messages, but keep reason-specific mapping so owners/users can distinguish:
  - token not found vs expired vs max uses vs already member vs trip full.

8) Validation checklist (before closing)
- Existing user clicks invite and joins directly.
- New user flow (email signup + verification + callback) returns to `/invite/{token}` automatically.
- OAuth flow (Google/Apple) returns to invite and completes acceptance.
- Sign-in/sign-up page switching does not lose `redirect` or `inviteToken`.
- Already-member case shows specific reason (not generic invalid).
- Links created before fix with low `max_uses` continue to work after backfill.
- Trip-full still correctly shows `trip_full` (not invalid).

Technical files to update
- `src/pages/AcceptInvite.tsx`
- `src/components/auth/SignInForm.tsx`
- `src/components/auth/SignUpForm.tsx`
- `src/components/auth/SocialLoginButtons.tsx`
- `src/components/auth/OAuthReturnHandler.tsx`
- `src/utils/authReturnPath.ts` (or new invite token utility)
- New backend migration for:
  - `public.accept_trip_invite`
  - `public.resolve_or_rotate_invite`
  - optional `public.get_trip_invite_info` reason alignment
  - one-time active invite max_uses uplift

Notes on your specific concerns
- This is not primarily an editor/reviewer permission issue.
- The biggest reliability gaps are invite-token continuity across auth transitions and too-low `max_uses` defaults causing link churn.
- This plan addresses both directly and makes failures diagnosable instead of collapsing into “invite invalid.”
