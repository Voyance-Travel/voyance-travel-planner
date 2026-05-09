## Fix 2 — Clear invite token on logout

### Verified
- `src/utils/inviteTokenPersistence.ts:42` exports `clearPendingInviteToken()` — zeros both `sessionStorage` and the durable `localStorage` entry.
- `src/contexts/AuthContext.tsx` `logout()` (~lines 538–588) already does ordered cleanup: save tour keys → `supabase.auth.signOut()` → wipe `legacyKeys` → wipe `voyance_quiz_*` → restore tour keys → null state.

### Change

In `src/contexts/AuthContext.tsx`:

1. Add import alongside other utils:
   ```ts
   import { clearPendingInviteToken } from '@/utils/inviteTokenPersistence';
   ```
2. Inside `logout()`, immediately after the `legacyKeys.forEach(... removeItem)` line and before the `voyance_quiz_*` sweep, call:
   ```ts
   clearPendingInviteToken();
   ```

### Out of scope
- No change to login, invite-consumption flow, or `OnboardConversation`.
- Tour-key preservation block is untouched (invite tokens are intentionally cross-user-sensitive, unlike tour state).

### Validation
- Sign in as user A with a `?invite=…` URL → confirm `pendingInviteToken` exists in `sessionStorage` and `localStorage`. Log out. Both keys gone. Sign in as user B on same device → no invite auto-consumed.
- Logout while no invite token present → no error, behavior unchanged.
