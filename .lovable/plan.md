## Problem

After the previous hardening pass, "Refine My Profile" now reaches the final step but throws:

```
QuotaExceededError: Failed to execute 'setItem' on 'Storage':
Setting the value of 'dna-disambig-resolved-<uid>' exceeded the quota.
```

The DB writes (profile update, DNA recalc, `travel_dna_profiles` upsert) all succeed, but the very last line — `localStorage.setItem(dismissKey, 'true')` in `src/components/profile/MicroDisambiguation.tsx` — throws because the user's localStorage is full (likely from accumulated trip drafts / cleanup checkpoints / itinerary caches). The uncaught throw lands in the outer `catch`, surfacing "Something went wrong" even though the refinement was saved server-side.

`dismissKey` is a tiny 4-byte write; the quota error means the *bucket* is full, not this key. So we need to (a) never let this cosmetic write break the flow, and (b) free space proactively so the dismiss flag actually persists across reloads.

## Fix

Edit `src/components/profile/MicroDisambiguation.tsx` only.

1. **Wrap both `localStorage.setItem(dismissKey, ...)` calls (lines 203 + 317) in `try/catch`.** Log `console.warn('[Disambig] dismiss_flag_persist_failed', err)` and continue. The DB row in `travel_dna_profiles.disambiguation_resolved_at` is already the authoritative source of truth — the localStorage flag is only a same-session optimization to avoid a re-fetch flicker.

2. **Add a small `pruneLocalStorageForQuota()` helper** invoked once before the setItem retry:
   - Remove obviously safe-to-evict keys in priority order: `voyance_trip_drafts`, `admin.*Cleanup.checkpoint.v1`, any key starting with `voyance.currencyToggle.`, any key matching `^trip-cache-` / `^itinerary-cache-`.
   - After pruning, retry the `setItem` once inside the same try/catch.
   - Never throw from the helper.

3. **Keep state updates (`setIsResolved(true)` + success toast) regardless of the setItem outcome** — the server write already succeeded by this point, so the UI should reflect that. Today the throw aborts both.

That's the entire change: ~25 lines in one file, no backend work, no new files.

## Out of scope

- Migrating other localStorage writes app-wide to a safe wrapper. Only the two sites that currently break the Refine flow are touched. We already have `safeSetItem` patterns in `src/utils/tripPersistence.ts`; a broader migration can follow if quota errors surface elsewhere.
- Changing the eviction policy of `tripPersistence` / cleanup checkpoints. The targeted prune above is enough to unstick this user.
- Memory entry: will add one if the same QuotaExceededError reappears after this fix.
