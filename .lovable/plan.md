## Cross-tab sign-out sync via BroadcastChannel

**Problem:** Sign-out in tab A doesn't propagate to tab B until next reload. `AuthContext.tsx` only listens to Supabase's per-tab `onAuthStateChange`.

### Change: `src/contexts/AuthContext.tsx`

Inside the existing `useEffect` (line 227, the same effect that subscribes to `onAuthStateChange`), open a `BroadcastChannel('voyance-auth')` and:

1. **Outbound** — when this tab observes a real `SIGNED_OUT` event from Supabase (the existing `if (event === 'SIGNED_OUT')` branch around line 282), `bc.postMessage({ type: 'auth:signout' })`. Also broadcast from the `logout()` method at line 545 right after `supabase.auth.signOut()` resolves, so the message goes out even if the listener races.
2. **Inbound** — `bc.onmessage` handler:
   - If `type === 'auth:signout'`: clear local state the same way the SIGNED_OUT branch does — `currentUserIdRef.current = null`, `setSession(null)`, `setUser(null)`, reset the singleton cache (`sg.initialized = false; sg.cachedUser = null; sg.cachedSession = null`), and call `supabase.auth.signOut({ scope: 'local' })` so this tab's stored token is wiped without re-broadcasting (use `scope: 'local'` to avoid hitting the server again — the originating tab already revoked the refresh token globally).
   - Skip if the tab is already signed out (no `session`) to avoid noisy redirects.
3. **Loop guard** — use a module-level `isHandlingRemoteSignout` ref so the local `SIGNED_OUT` event triggered by step 2's `signOut({ scope: 'local' })` doesn't re-broadcast and ping-pong.
4. **Cleanup** — add `bc.close()` to the existing `return () => { … }` cleanup at line 446.

### Optional sign-in mirror (low priority)

Same channel, `type: 'auth:signin'` on `SIGNED_IN`. Receiving tabs call `supabase.auth.getSession()` to pick up the new session from shared localStorage and re-run `loadUserData`. **Not in scope** unless the user wants tab B to auto-sign-in after tab A logs in — defer; the urgent issue is sign-out propagation on shared devices.

### Browser support / fallback

`BroadcastChannel` is supported on all current evergreen browsers and recent Safari (15.4+). For older Safari, add a thin fallback: subscribe to `window.addEventListener('storage', …)` and watch for the Supabase auth key being deleted (`e.key?.startsWith('sb-') && e.key.endsWith('-auth-token') && e.newValue === null`) — same handler as the BroadcastChannel inbound. Wrap the channel construction in `typeof BroadcastChannel !== 'undefined'`.

### Verification

- Open the app in tabs A and B, both signed-in to the same account.
- In tab A click Logout. Within ~1s, tab B's `user` and `session` go null and routing redirects to landing/login.
- Reload tab B — it stays signed-out (storage was wiped).
- Sign in tab A, sign in tab B. Sign out tab A → tab B clears. No infinite loop in either tab's console.
- Older browser without `BroadcastChannel`: storage-event fallback fires the same clear path.

### Files touched

- `src/contexts/AuthContext.tsx` only.

No backend, no migration, no new dependency.
