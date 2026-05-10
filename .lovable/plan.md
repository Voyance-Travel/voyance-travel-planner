## RS.M11 — Module-level dedup for `useDestinationEnrichment`

The hook currently dedups per-instance via `triggeredRef`, so two simultaneous mounts of the same destination (multi-tab UI, parent + child both mounting, fast remounts) each fire `enrich-destination`. The DB `enriched_at` guard catches it server-side, but we still pay the round-trip + LLM call.

The user's snippet is a simplification — the real hook also tracks `isEnriching` / `enrichmentDone` state, runs a thinness check, and invalidates 3 react-query keys on success. The plan keeps all that and only changes the gating layer.

### Change — `src/hooks/useDestinationEnrichment.ts`

1. Add module-level dedup map at top of file (above the hook):
   ```ts
   // Shared across all hook instances in this tab. Cross-tab dedup is handled
   // by the DB-side `enriched_at` guard inside the enrich-destination function.
   const enrichInFlight = new Map<string, Promise<void>>();
   ```

2. Inside the `useEffect`, after the existing thinness check passes, key by `dbDestination.id.toLowerCase()`:
   - If `enrichInFlight.has(key)` → bail out (no state flip, no invoke). The other mount will invalidate queries on completion, and react-query's shared cache will deliver the result to this mount.
   - Otherwise create the promise, store it in the map, and `delete` in `finally`. Wrap the existing `enrich()` body so the map cleanup is guaranteed.

3. Keep `triggeredRef` as the per-instance guard (prevents the same mount from re-firing on unrelated re-renders before the module map is populated). Both guards coexist.

4. No change to the return shape, the thinness logic, or the invalidation keys.

### Verification

- `grep -c "enrichInFlight\|Map<string, Promise<void>>" src/hooks/useDestinationEnrichment.ts` ≥ 1 (expect 3+).
- Manual: open two destination tabs simultaneously for an unenriched city → only one `enrich-destination` invocation in network tab.

### Out of scope

- Cross-tab dedup (handled by DB).
- Refactoring the thinness heuristic.
- Changing the enrich-destination function itself.
