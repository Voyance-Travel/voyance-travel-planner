## OAuth account-merge confirmation toast

**Problem:** When an existing email/password user signs in with Google (same email), Supabase silently links the OAuth identity to the existing account. The user sees no acknowledgement and often opens a support ticket thinking they have two accounts or that their data is gone.

**Goal:** Show a one-time, friendly toast — *"We've connected your Google account to your existing Voyance account. You can now sign in either way."* — exactly once per merge event, then never again for that user/provider pair.

### Detection: in `src/contexts/AuthContext.tsx`

The OAuth-completion path is the existing `SIGNED_IN` branch (around line 309–337) where `provider !== 'email'` is already detected for `logOAuthLogin`. Extend that block:

1. Read `newSession.user.identities` (array of `{ provider, identity_data, created_at, last_sign_in_at, … }` returned by Supabase Auth).
2. Treat it as a merge-just-happened when **all** are true:
   - There are ≥ 2 distinct identities.
   - One identity has `provider === 'email'` (the pre-existing password account).
   - One identity has `provider === <oauth-provider>` matching `newSession.user.app_metadata.provider` (e.g. `google` or `apple`).
   - The OAuth identity's `created_at` is **after** the email identity's `created_at` (so the OAuth one was added later — true merge, not OAuth-first signup).
   - A localStorage flag `voyance_merge_notified:{userId}:{provider}` is **not** present.
3. If all true: show a sonner toast with a clear message and a 6 s duration, then write the localStorage flag.

```ts
const provider = newSession.user.app_metadata?.provider;
const identities = newSession.user.identities ?? [];
if (provider && provider !== 'email' && identities.length >= 2) {
  const emailId  = identities.find(i => i.provider === 'email');
  const oauthId  = identities.find(i => i.provider === provider);
  const flagKey  = `voyance_merge_notified:${newSession.user.id}:${provider}`;
  if (
    emailId && oauthId &&
    new Date(oauthId.created_at) > new Date(emailId.created_at) &&
    !localStorage.getItem(flagKey)
  ) {
    const label = provider === 'google' ? 'Google'
                : provider === 'apple'  ? 'Apple'
                : provider.charAt(0).toUpperCase() + provider.slice(1);
    toast.success(`Your ${label} account is now linked to your Voyance account`, {
      description: 'You can sign in with either email/password or ' + label + ' from now on.',
      duration: 6000,
    });
    localStorage.setItem(flagKey, new Date().toISOString());
  }
}
```

Place it inside the existing `if (event === 'SIGNED_IN' && newSession?.user) { … }` block, right after `logOAuthLogin(provider)` is fired (~line 333). The check is cheap and synchronous; no extra API call is needed because `identities` is already in the session.

### Why not a server-side notification?

The merge is implicit in Supabase Auth — there's no `account.linked` webhook or DB row that flips. The session's `identities` array is the single source of truth and is already on the client at the moment of OAuth return, so client-side detection is the simplest correct path.

### Edge cases handled

- **OAuth-first user** (no email identity): `emailId` is undefined → no toast. ✅
- **Returning Google user** (already merged in a previous session): localStorage flag set on first occurrence → suppressed forever. ✅
- **OAuth identity created at the same time as email identity** (signed up via OAuth and then added password later): the time-ordering check handles this correctly — only the *later* identity's appearance triggers a toast, and we only fire when OAuth was the later one. (We could optionally do the inverse — toast when password is added to an OAuth account — but Supabase doesn't have a `user.addPassword` flow in this app, so skip.)
- **Cleared localStorage / new device:** the flag is per-device, so a user who clears storage may see the toast once more. Acceptable; the message is friendly, not alarming.
- **SSR / no `localStorage`:** wrapped in a `typeof localStorage !== 'undefined'` guard for safety, even though this is client-only code.

### Toast styling

Use the project's existing `sonner` import (`import { toast } from 'sonner'`). No new dependencies. The existing `<Toaster />` is already mounted in `App.tsx`.

### Files touched

- `src/contexts/AuthContext.tsx` — single insertion in the `SIGNED_IN` branch, plus a `toast` import if not already present.

No backend change, no migration, no new edge function. Pure client.

### Verification

1. Create an account with email/password, sign out.
2. On the same browser, click "Sign in with Google" using the same email → Supabase merges → toast appears once.
3. Sign out, sign in with Google again → no toast.
4. Sign in with email/password → no toast.
5. Clear `voyance_merge_notified:*` keys → next OAuth sign-in shows the toast again (expected).
6. Brand-new Google-first signup (no prior email account) → no toast.
