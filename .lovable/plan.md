

## Harden Invite Link Flow & Add Diagnostics

### Context
Backend investigation confirms invite links support multi-use (max_uses=10, tested via direct RPC). The "Link Not Valid" error reported for user 2 cannot be reproduced from the code. This plan adds diagnostics and robustness improvements to surface the root cause.

### Changes

**1. AcceptInvite.tsx — Better error diagnostics and retry**
- Log the full RPC response (not just errors) to console for debugging
- Add a "Try Again" button on the error page that re-fetches invite info (currently errors are terminal)
- Show the raw reason code more prominently in dev/preview environments
- Distinguish network errors from actual invalid tokens visually

**2. inviteResolver.ts — Add response logging**
- Log the full `resolve_or_rotate_invite` response for debugging
- Include the token prefix in logs for correlation

**3. AcceptInvite.tsx — Auto-retry on network errors**
- If `get_trip_invite_info` fails with a network error (not a business logic error like expired/replaced), auto-retry once after 1 second
- Only clear the persisted token on confirmed terminal reasons, not on transient failures

**4. TripShareModal — Show remaining uses indicator**
- After resolving the invite link, show "X spots remaining" based on `maxUses - usesCount` from the invite health response
- Reassures the owner the link supports multiple people

### Technical Detail

The `InviteHealth` response from `resolveInviteLink` already includes `usesCount` and `maxUses`. Surface this in TripShareModal:
```tsx
{inviteHealth && (
  <p className="text-xs text-muted-foreground">
    {inviteHealth.maxUses - inviteHealth.usesCount} spots remaining
  </p>
)}
```

For the retry in AcceptInvite:
```tsx
const [retryCount, setRetryCount] = useState(0);

const retryFetch = () => {
  setError(null);
  setLoading(true);
  setRetryCount(c => c + 1);
};

// Add retryCount to the useEffect dependency to trigger re-fetch
useEffect(() => { ... }, [token, retryCount]);
```

### Files

| File | Change |
|---|---|
| `src/pages/AcceptInvite.tsx` | Add retry button, better error logging, auto-retry on network errors |
| `src/services/inviteResolver.ts` | Add response logging |
| `src/components/sharing/TripShareModal.tsx` | Show remaining spots from invite health |

