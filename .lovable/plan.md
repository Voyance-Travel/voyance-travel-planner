## Fix 2.3b — Native-aware OAuth redirect URLs

Two files, mechanical swaps per the spec.

### `src/components/auth/SocialLoginButtons.tsx`

1. Add `import { Capacitor } from '@capacitor/core';` (after the existing imports, ~line 9).
2. Add `getAuthRedirectUrl()` helper between the imports and `isCustomDomain` (or just before the component). Returns `'voyance://auth/callback'` on native, else `${window.location.origin}/auth/callback`.
3. Replace `window.location.origin` → `getAuthRedirectUrl()` in **all four** OAuth call sites:
   - Line 48 — Apple custom-domain branch (`redirectTo`)
   - Line 59 — Apple lovable branch (`redirect_uri`)
   - Line 80 — Google custom-domain branch (`redirectTo`)
   - Line 91 — Google lovable branch (`redirect_uri`)

   Note: the helper now returns `…/auth/callback` (path included) instead of bare origin. This is a slight URL change for web (was `/`, now `/auth/callback`); the spec calls for it explicitly.

### `src/contexts/AuthContext.tsx`

Replace lines 489–496 (signup `redirectUrl` block) with the spec's branched version:

```ts
const { Capacitor } = await import('@capacitor/core');
const baseUrl = Capacitor.isNativePlatform()
  ? 'voyance://auth/callback'
  : `${window.location.origin}/`;

let redirectUrl = baseUrl;
try {
  const { peekPendingInviteToken } = await import('@/utils/inviteTokenPersistence');
  const pendingToken = peekPendingInviteToken();
  if (pendingToken) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    redirectUrl = `${baseUrl}${sep}inviteToken=${encodeURIComponent(pendingToken)}`;
  }
} catch { /* ignore */ }
```

### Scope

2.3b only — TypeScript-side branching. 2.3c (Info.plist + AndroidManifest scheme registration + `App.addListener('appUrlOpen')` deep-link handler) is a separate ticket.

### Verify

```bash
grep -n "getAuthRedirectUrl\|voyance://auth/callback" src/components/auth/SocialLoginButtons.tsx
# Expected: 1 helper def + 4 call sites = 5+ hits, plus 1 'voyance://' inside the helper

grep -n "voyance://auth/callback" src/contexts/AuthContext.tsx
# Expected: 1 hit in signup()
```

Web behavior unchanged in practice (origin-relative redirects); native now hands the OS a scheme it can route back to the app.