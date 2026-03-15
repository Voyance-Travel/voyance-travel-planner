

# Fix: Days randomly locked + unplanned last day not being healed

## Two Distinct Issues

### Issue 1: Days appear "locked" after network errors
**Root cause**: When `get-entitlements` fails (due to `ERR_CONNECTION_RESET`), it falls back to `getDefaultEntitlements()` which sets `unlocked_day_count: 0` and `is_first_trip: true`. This means only days 1-2 are viewable — all other days show the LockedDayCard, even though the user has paid for them. The user sees "Unlock this day" on days they already own.

**Fix**: The default entitlements fallback should NOT regress to a locked state when we already have cached entitlements data. Two changes:

1. **`src/hooks/useEntitlements.ts`** — Use `placeholderData` (or `keepPreviousData` in React Query) so that when a refetch fails, the UI continues showing the last successful entitlements response rather than restrictive defaults.

2. **`src/hooks/useEntitlements.ts`** — In the error fallback, check if we have a previously cached result before returning the restrictive defaults. If we do, return the cached version instead:
   ```typescript
   if (error) {
     // Try to return previously cached entitlements instead of restrictive defaults
     const cached = queryClient.getQueryData<EntitlementsResponse>(['entitlements', user?.id, tripId]);
     if (cached) return cached;
     return getDefaultEntitlements(user?.id || '');
   }
   ```

### Issue 2: Unplanned day self-heal doesn't retry after failure
**Root cause**: The self-heal at line 1137 of `TripDetail.tsx` sets `autoResumeAttemptedRef.current = true` before calling `regenerate-day`. If the edge function call fails (same network issues), it never retries because the ref is already set.

**Fix** in **`src/pages/TripDetail.tsx`**:

1. Move `autoResumeAttemptedRef.current = true` to **after** successful regeneration, not before. On failure, reset it so the next load can retry:
   ```typescript
   if (emptyDayNumbers.length > 0 && emptyDayNumbers.length < expectedTotal) {
     console.warn(`[TripDetail] Self-heal: ${emptyDayNumbers.length} days have no activities`);
     setTimeout(async () => {
       try {
         autoResumeAttemptedRef.current = true; // Set during attempt
         for (const dayNum of emptyDayNumbers) {
           await supabase.functions.invoke('generate-itinerary', { ... });
         }
         queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
         toast.success(`Regenerated ${emptyDayNumbers.length} unplanned day(s)`);
       } catch (err) {
         console.error('[TripDetail] Auto-regenerate failed:', err);
         autoResumeAttemptedRef.current = false; // Reset so it retries next load
       }
     }, 2000);
   }
   ```

2. Additionally, the self-heal should also check if the `itinerary_days` table has empty activities (which it does — all 0 for both Florence and Venice), confirming the data never made it to the DB either.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useEntitlements.ts` | Return cached entitlements on error instead of restrictive defaults; keep previous data during refetches |
| `src/pages/TripDetail.tsx` | Reset `autoResumeAttemptedRef` on self-heal failure so it retries on next page load |

