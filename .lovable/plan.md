## Fix 2.3c — Handle `appUrlOpen` on native

### 1. Install dep

`@capacitor/app` is not in `node_modules`. Add it:

```bash
bun add @capacitor/app
```

(matches existing `@capacitor/core` major; `bun` per project convention.)

### 2. New file — `src/lib/native/oauthDeepLink.ts`

Create as specified. Listens for `appUrlOpen`, filters URLs starting with `voyance://auth`, and:
- Implicit flow (tokens in `#fragment`) → `supabase.auth.setSession({ access_token, refresh_token })`
- PKCE flow (`?code=` in query) → `supabase.auth.exchangeCodeForSession(code)`
- Errors caught and `console.error`'d under `[OAuthDeepLink]` tag.

Web platform: early-return via `Capacitor.isNativePlatform()` so the listener is a no-op in browser preview / PWA.

### 3. Wire into `src/main.tsx`

Add at top with other imports:
```ts
import { registerOAuthDeepLinkHandler } from "@/lib/native/oauthDeepLink";
```

Call once at startup, immediately before the `createRoot(...).render(<App />)` line (line 91):
```ts
registerOAuthDeepLinkHandler();
```

Picking `main.tsx` over `App.tsx` so it runs exactly once outside React's render cycle (no double-listener risk under StrictMode).

### Scope

2.3c only — deep-link bridge. Native-side scheme registration (Info.plist `CFBundleURLSchemes`, AndroidManifest `intent-filter`) happens in Xcode/Android Studio after `npx cap sync` propagates the `scheme: 'voyance'` from `capacitor.config.ts` (already landed in 2.3a). User runs that locally; it's not in this repo.

### Verify

```bash
grep -n "registerOAuthDeepLinkHandler" src/main.tsx src/lib/native/oauthDeepLink.ts
# Expected: 1 export def + 1 import + 1 call = 3 hits
grep -n '"@capacitor/app"' package.json
# Expected: 1 hit in dependencies
```