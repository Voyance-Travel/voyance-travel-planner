

## Fix: Authenticated Users Stuck on Sign-In Page

### Problem
The `/signin` route renders unconditionally — there's no check to redirect already-authenticated users away. If you're signed in and land on `/signin` (via bookmark, stale tab, or a race condition during auth loading), you see the sign-in form with no indication you're already authenticated.

### Root Cause
`SignIn.tsx` and the `/signin` route in `App.tsx` have no authentication guard. Unlike protected routes that redirect *to* sign-in, there's no reverse guard that redirects *away* from sign-in when authenticated.

### Fix — 1 file

**`src/pages/SignIn.tsx`** — Add an early redirect for authenticated users

At the top of the component, check `useAuth()`. If the user is already authenticated (and not loading), redirect them to the intended destination or `/profile`:

```typescript
const { isAuthenticated, isLoading } = useAuth();
const navigate = useNavigate();

useEffect(() => {
  if (!isLoading && isAuthenticated) {
    navigate(nextPath || '/profile', { replace: true });
  }
}, [isAuthenticated, isLoading, navigate, nextPath]);
```

This handles:
- Direct navigation to `/signin` while logged in → redirects to `/profile`
- Redirect from a protected route that resolved late → forwards to the original `?next=` destination
- OAuth callback landing on `/signin` instead of `/` → redirects appropriately

The same pattern should be applied to `SignUp` page for consistency, but the immediate fix is `/signin`.

### Files
- `src/pages/SignIn.tsx` — add authenticated-user redirect

