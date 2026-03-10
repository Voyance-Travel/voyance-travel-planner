

## Plan: Fix Blank White Screen After Google SSO Sign-In

Three targeted fixes across three files to resolve the OAuth race condition and missing navigation fallback.

### Fix A: Queue SIGNED_IN events during initial load (`src/contexts/AuthContext.tsx`)

1. **Add ref** (after line 221): `const pendingOAuthSessionRef = useRef<any>(null);`

2. **Replace early return** (lines 263-266): Instead of dropping all events during initial load, queue `SIGNED_IN` events with a valid session into `pendingOAuthSessionRef`.

3. **Replace no-session block** (lines 343-348): After `getSession()` returns null, check `pendingOAuthSessionRef` first. If empty, wait 500ms and retry `getSession()` once more (belt-and-suspenders for slow hash processing). Only give up if both checks fail.

### Fix B: Add fallback navigation (`src/components/auth/OAuthReturnHandler.tsx`)

Replace lines 62-66: After the existing return-path check, add a fallback that navigates authenticated users on `/` to `/profile` instead of leaving them stranded.

### Fix C: Save return path before OAuth (`src/components/auth/SocialLoginButtons.tsx`)

Replace lines 27-34: In `persistAuthReturnPath`, add an `else` branch that saves `window.location.pathname` when no explicit `?redirect=`/`?next=` param exists. Since `saveReturnPath` already filters out `/signin`/`/signup`, auth pages won't be saved — the Fix B fallback (`/profile`) takes over correctly.

### Why all three are needed

- **A** alone fixes the race condition but users still land on `/` with no redirect
- **B** alone provides a fallback but users may still not be authenticated due to the race
- **C** ensures future OAuth flows from pages with no URL params still have a return path

