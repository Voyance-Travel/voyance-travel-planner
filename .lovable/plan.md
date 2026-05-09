## Fix 3 — Gate post-signup redirect on quiz completion

### Verified
- `AuthContext.signup` returns `Promise<{ needsEmailConfirmation?: boolean }>` only — no `user`/`quizCompleted` exposed today.
- `SignUpForm.onSubmit` (lines 113–140) currently routes: `needsEmailConfirmation` → confirmation card; else `pendingToken` → `/invite/:token`; else `queryRedirect || consumeReturnPath('/')`.
- `ProtectedRoute` already enforces `!user.quizCompleted → ROUTES.QUIZ` for `requireQuiz` routes — so the gap is only "fresh signup lands on a non-protected page (e.g. `/`) and never hits the quiz".
- Email-confirmation links land on `/` (with optional `?inviteToken=`); `OAuthReturnHandler` picks them up. Today the no-invite/no-returnPath fallback sends users to `/profile`, bypassing the quiz for unconfirmed signups.

### Changes

**1. `src/contexts/AuthContext.tsx` — extend `signup()` return shape**

Change the return type to `Promise<{ needsEmailConfirmation?: boolean; quizCompleted?: boolean }>`.
- Brand-new signups have not completed the quiz → return `quizCompleted: false` from BOTH the `needsEmailConfirmation` branch (line 524) AND the success branch (line 536).
- No DB read needed; default-false is correct for any fresh signup.

**2. `src/components/auth/SignUpForm.tsx` — quiz redirect branch**

In `onSubmit` after the invite-token check, add:
```ts
} else if (result?.quizCompleted === false) {
  navigate(ROUTES.QUIZ, { replace: true });
} else {
  navigate(queryRedirect || consumeReturnPath('/'));
}
```
Order stays: `needsEmailConfirmation` → invite → **quiz** → returnPath. Invite-acceptance still wins (the invite flow itself can route to quiz afterward if needed; we don't want to swallow an invite token).

**3. `src/components/auth/OAuthReturnHandler.tsx` — quiz gate on the `/profile` fallback**

Read `user` from `useAuth()` (already imported). In the **final fallback** (lines 69–73, the "authenticated on `/` with no return path and no invite" branch), redirect to `ROUTES.QUIZ` instead of `/profile` when `!user?.quizCompleted`. This covers:
- Email-confirmation links landing on `/` for fresh signups (no invite, no returnPath).
- OAuth signups that skip the email confirmation step.

Do **not** add a quiz gate to the invite branches (priorities 1–3) — invite acceptance is critical and the invite page can route to the quiz afterward.
Do **not** add a quiz gate to the explicit `returnPath` fallback (line 63) — existing users with intentional return paths (e.g. deep links) shouldn't be hijacked; `ProtectedRoute(requireQuiz)` already covers protected destinations.

### Out of scope
- No schema changes, no new queries.
- No change to `LoginForm` or social login (`SocialLoginButtons`) — sign-in users either already completed the quiz or are caught by `ProtectedRoute(requireQuiz)`.

### Validation
1. Fresh email signup with auto-confirm off → confirmation card. Click email link → lands on `/` → `OAuthReturnHandler` redirects to `/quiz` (not `/profile`).
2. Fresh email signup with auto-confirm on → `SignUpForm` redirects to `/quiz` (not `/`).
3. Signup with `?inviteToken=xyz` → still redirects to `/invite/xyz` (invite wins over quiz).
4. Existing user signs up again with `?redirect=/some-page` → `needsEmailConfirmation` returns; after re-confirm + login they hit returnPath; if that page is `requireQuiz` and they're already completed, no redirect; if not completed, `ProtectedRoute` already routes them to `/quiz`.
5. Login (not signup) for an existing quiz-completed user → no behavior change.
