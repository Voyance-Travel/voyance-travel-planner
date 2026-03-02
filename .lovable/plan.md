
Goal: identify why invite links are failing and implement a durable fix so users can consistently join trips.

What I found (root cause diagnosis):
1) This is not a permission-role issue.
- Invite acceptance always inserts collaborators with default permission (`view`), and role checks are not what produce “invalid invite”.

2) The backend invite functions are mostly working, but capacity checks are rejecting some links.
- I verified current invite records and token health.
- At least one currently active token resolves as `trip_full` (no spots remaining), which users experience as “link broken”.
- This is driven by `travelers` vs accepted collaborator count.

3) Invite context can still be lost after account creation/verification.
- You already fixed part of this with saved return path before auth.
- Remaining weak point: return-path storage is session-tab scoped, so verification/open-in-new-tab flows can still lose invite context.

4) There is an inconsistent invite-creation path that bypasses the centralized resolver.
- `PaymentsTab` directly inserts into `trip_invites` and builds links separately.
- That creates flow inconsistency and makes invite behavior harder to trust/debug.

Implementation plan:
1) Unify invite creation across all UI entry points
- Replace direct `trip_invites` insert in `PaymentsTab` with the same centralized invite resolver flow used elsewhere.
- Ensure every “send/copy invite” action pulls from one source of truth.

2) Make auth-return persistence robust across verification/new-tab flows
- Extend return-path persistence from session-only to a safer fallback strategy (session + durable fallback).
- Keep redirect intent through sign-in/sign-up toggles and verification completion.

3) Improve invite failure diagnostics in UI
- Distinguish and display exact states (`trip_full`, `expired`, `invite_limit_reached`, `invalid_token`) with clear owner actions.
- In owner share UI, block/stale-proof copying when link is no longer valid and show “spots remaining” prominently.

4) Tighten backend acceptance behavior
- Update invite acceptance logic to better handle rejoin scenarios (without falsely returning “already_member” when user should be restorable).
- Keep collaborator + member synchronization consistent.

5) Add observability for invite lifecycle
- Add lightweight structured logging/telemetry around:
  - link generated
  - link opened
  - accept attempted
  - accept failed reason
- This makes future failures immediately diagnosable instead of guesswork.

6) Verification checklist (before closing)
- Existing user accepts invite from published domain.
- New user accepts invite via signup + email verification path.
- OAuth accept path (Google/Apple) returns to exact invite URL.
- Trip-full case shows explicit capacity messaging.
- Rejoin flow works after collaborator removal.

Technical notes:
- Primary files to update: `AcceptInvite.tsx`, `SignInForm.tsx`, `SignUpForm.tsx`, `SocialLoginButtons.tsx`, `PaymentsTab.tsx`, invite resolver service, and invite-related backend functions.
- No role data will be moved to profile/users tables; access control remains backend-validated.
