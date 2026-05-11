# Fix: Google sign-in lands on "Wrong turn" 404

## Root cause

`src/components/auth/SocialLoginButtons.tsx` (line 19) sends Google/Apple OAuth back to `${window.location.origin}/auth/callback`. There is **no `/auth/callback` route registered** in `src/App.tsx` — the React Router catch-all renders `NotFound.tsx`, whose copy starts with the "Wrong turn. This page doesn't exist, but your next trip could…" headline the user is seeing.

The auth session itself is set correctly by `lovable.auth.signInWithOAuth` before the redirect, so `AuthContext.onAuthStateChange` already fires `SIGNED_IN`. The bug is purely a missing route handler — the user is authenticated but stranded on a 404.

## Fix

### 1. Add an `AuthCallback` page (`src/pages/AuthCallback.tsx`)

- Show a minimal centered "Signing you in…" spinner (re-use `RouteFallback` styling).
- On mount: read the auth context. As soon as `user` is present (or after a short grace period via `onAuthStateChange`), call `consumeReturnPath('/profile')` and `navigate(returnPath, { replace: true })`.
- If after ~6 seconds there is still no session, navigate to `/signin?error=oauth_failed` with a toast, so we don't trap users in an infinite spinner when the broker fails silently.
- Honor a pending invite token: if `popPendingInviteToken()` exists, prefer `/invite/<token>` over the saved return path (mirror existing `AcceptInvite` behavior).

### 2. Register the route in `src/App.tsx`

Add inside the **Auth Routes** block (next to `/signin`, `/signup`):

```tsx
<Route path="/auth/callback" element={<AuthCallback />} />
```

Public route (no `ProtectedRoute` wrapper) so unauthenticated arrivals during the brief session-write window aren't bounced.

### 3. Leave `getAuthRedirectUrl` as-is

`/auth/callback` is the documented redirect for both the Lovable broker and the custom-domain `supabase.auth.signInWithOAuth` branch — fixing the missing route is the correct change. Native (`voyance://auth/callback`) is already handled separately by `src/lib/native/oauthDeepLink.ts`.

## Out of scope

- No changes to `AuthContext`, `lovable` integration, or Supabase config.
- No changes to `NotFound.tsx` copy.
- No new edge functions or migrations.

## Verification

1. Sign in with Google in preview → expect brief "Signing you in…" splash → land on `/profile` (or last-saved path), never on the 404 page.
2. Console: `[404] Route not found: /auth/callback` warning disappears.
3. Sign-in via custom domain (`travelwithvoyance.com`) → same behavior (the `isCustomDomain` branch also redirects to `/auth/callback`).
4. Existing email/password sign-in flow unchanged.
