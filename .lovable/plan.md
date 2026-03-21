

## Fix: Credit Counter Flicker During Retry Flows

### Problem
When a retry flow triggers multiple credit operations, the credit counter shows unexpected intermediate values before settling to the correct final number. The display "bounces" because each operation calls `invalidateQueries(['credits', userId])`, which triggers an async refetch from the database. Between the invalidation and refetch completing, the UI shows stale cached data — or worse, a mid-transaction snapshot from a concurrent refetch.

### Root Cause
`useSpendCredits.onSuccess` uses `invalidateQueries` (async refetch) instead of `setQueryData` (immediate cache update). The `spend-credits` endpoint already returns the authoritative `newBalance` in every response, but this data is discarded — the client refetches from the DB instead.

During retries:
1. Spend call #1 succeeds → invalidate → refetch starts (shows old balance)
2. Spend call #2 succeeds → invalidate → refetch starts (may return balance after call #1 but before #2)
3. Final refetch settles to correct value

### Fix

**File: `src/hooks/useSpendCredits.ts` — `onSuccess` callback (~line 123)**

Replace the `invalidateQueries` call with an immediate `setQueryData` using the `newBalance` returned by the server, then invalidate as a background refresh:

```typescript
onSuccess: (data, variables) => {
  if (user?.id && data.newBalance) {
    // Immediately update cache with server-returned balance
    queryClient.setQueryData(['credits', user.id], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        totalCredits: data.newBalance.total,
        purchasedCredits: data.newBalance.purchased,
        effectiveFreeCredits: data.newBalance.free,
        freeCredits: data.newBalance.free,
      };
    });
    // Background refresh for full data consistency (purchases list, etc.)
    queryClient.invalidateQueries({ queryKey: ['credits', user.id] });
    queryClient.invalidateQueries({ queryKey: ['entitlements', user.id] });
    // ...existing action-cap invalidation
  }
},
```

This ensures the credit counter updates instantly to the correct value from the server response, eliminating the visual flicker window. The subsequent `invalidateQueries` still runs to refresh the full `purchases` array and other derived fields, but the user-visible balance is already correct.

### Scope
1 file, ~8 lines changed. No backend changes.

