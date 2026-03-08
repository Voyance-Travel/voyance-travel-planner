
Goal: stop the recurring full-screen invite takeover (“haunted invite”), add a true decline path on the full-screen invite experience, and prevent self-share edge cases from being created again.

1) Root cause confirmed
- `AcceptInvite.tsx` currently calls `savePendingInviteToken(token)` on mount every time.
- `OAuthReturnHandler.tsx` consumes any persisted invite token on `/` and redirects to `/invite/{token}`.
- There is no `clearPendingInviteToken()` usage in the app, so the token gets re-saved and re-triggered indefinitely.
- The full-screen invite page has only “Join This Trip” (no decline/dismiss action).
- Self-invite hits `accept_trip_invite` with `reason: already_owner`, but that still leaves the persisted token loop intact.

2) Frontend fixes (primary)
- Update `src/pages/AcceptInvite.tsx`:
  - Import and use `clearPendingInviteToken`.
  - Change token persistence behavior:
    - Persist token only when user is not authenticated (needed for auth handoff).
    - Clear persisted token when authenticated and viewing `/invite/:token` so it cannot re-trigger later.
  - Add explicit secondary actions on full-screen invite:
    - “Decline Invite” (or “Not now”) to clear token and exit to a safe page (`/trip/dashboard` or `/`).
  - On terminal outcomes (`already_owner`, `already_member`, invalid/expired token), clear persisted token immediately.
  - Keep retry behavior for transient network failures (don’t clear token on temporary RPC/network errors).
- Update `src/components/auth/OAuthReturnHandler.tsx`:
  - Tighten fallback behavior so stale durable tokens do not redirect users forever on normal homepage visits.
  - Keep invite recovery for real auth-return flows (query invite token and saved return path remain supported).

3) Invite UX improvement for self-share case
- Extend invite preview payload so UI can detect owner context without forcing a failed join:
  - Update DB function `get_trip_invite_info` to also return `tripId` and owner/inviter metadata (e.g., `ownerId` or `invitedBy`).
- In `AcceptInvite.tsx`, when current user is the owner:
  - Hide/disable “Join This Trip”.
  - Show owner-safe CTA (“Open Trip” / “Go to Dashboard”).
  - Clear persisted token so the takeover cannot return.

4) Prevention guardrails (future-proofing)
- Update `src/services/tripCollaboratorsAPI.ts`:
  - Block self-collaboration attempts (`userId === currentUser.id`) with a clear user-facing error.
- Add backend policy hardening (migration):
  - Prevent owner from inserting themselves into `trip_collaborators` via normal collaborator-add flow (DB-level guard), so test/self-share loops are harder to create accidentally.

5) Validation checklist (end-to-end)
- Logged-in owner opens own invite link:
  - No repeated takeover after leaving page/refreshing.
  - No broken join error loop.
- Logged-in recipient declines from full-screen invite:
  - Invite closes, user exits flow, and it does not reopen on next site visit.
- Logged-out invite flow:
  - Sign in/sign up returns user to invite once, then token is cleared after resolution.
- Attempt to add yourself as collaborator:
  - Blocked cleanly with explanatory message.

Files planned
- `src/pages/AcceptInvite.tsx`
- `src/components/auth/OAuthReturnHandler.tsx`
- `src/services/tripCollaboratorsAPI.ts`
- New migration to update invite info function + collaborator self-add guard policy
