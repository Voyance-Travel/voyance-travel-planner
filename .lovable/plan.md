## Fix 4.2 — Push token cleanup on logout

**File:** `src/contexts/AuthContext.tsx`

Insert a push-token delete block immediately **before** `await supabase.auth.signOut();` at line 570 (after the `TOUR_KEYS.forEach` save loop ending line 568).

```ts
// Delete this user's push tokens BEFORE signing out so RLS allows the delete.
// Prevents notifications meant for this user from reaching the next user
// who logs in on the same device.
if (user) {
  try {
    const { error: pushDelError } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id);
    if (pushDelError) {
      console.error('[Auth] Failed to delete push tokens on logout:', pushDelError);
    }
  } catch (pushErr) {
    console.error('[Auth] Push token cleanup exception:', pushErr);
  }
}
```

Guarded by `if (user)` so already-signed-out logouts don't error. Errors are logged, not thrown — cleanup failure must not block logout.

**Verify:** `grep -n "from('push_tokens').delete" src/contexts/AuthContext.tsx` → 1 hit in logout flow.