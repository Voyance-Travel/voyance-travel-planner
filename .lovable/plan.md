

# Fix: Replace remaining direct auth refresh call in useItineraryGeneration

## What went wrong

The previous fix attempt added the `guardedRefreshSession` import to `useItineraryGeneration.ts` (line 6) but **failed to replace the actual call** on line 553. The file still has:
- `await supabase.auth.refreshSession()` (line 553) -- should be `await guardedRefreshSession()`
- Triple `reportConnectionFailure()` on lines 558-560 -- should be a single call

This means every connection error during itinerary generation triggers an unguarded, non-deduplicated auth refresh that competes with other auth operations, producing the lock contention flood you're seeing.

## Changes (1 file)

### `src/hooks/useItineraryGeneration.ts` (lines 551-560)

Replace:
```typescript
supabase.removeAllChannels();
await supabase.auth.refreshSession();
resubscribeAll();
resetConnectionFailures();
} catch (cleanupErr) {
  console.warn('[useItineraryGeneration] Post-failure cleanup failed:', cleanupErr);
  reportConnectionFailure();
  reportConnectionFailure();
  reportConnectionFailure();
```

With:
```typescript
supabase.removeAllChannels();
await guardedRefreshSession();
resubscribeAll();
resetConnectionFailures();
} catch (cleanupErr) {
  console.warn('[useItineraryGeneration] Post-failure cleanup failed:', cleanupErr);
  reportConnectionFailure();
```

This is a 2-line change -- swap the direct call for the guarded version, and remove the triple failure report (the throttle in ConnectionRecoveryBanner now handles escalation properly).

## Why this fixes it

The `guardedRefreshSession` utility deduplicates concurrent refresh calls and enforces a 10-second cooldown. Without it, every network timeout during generation fires an unthrottled `refreshSession()` that races the SDK's own auto-refresh, creating the lock contention cascade.

