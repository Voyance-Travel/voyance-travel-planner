## Goal

Get `generate-itinerary` under Supabase's 5 MB deploy ceiling by splitting non-generation actions into a sibling edge function. Zero behavior changes.

## Current state

- `supabase/functions/generate-itinerary/` reachable source ≈ 4.6 MB raw (over 5 MB bundled).
- Router (`index.ts`) statically imports all 10 action handlers, so esbuild bundles everything for every request, even tiny read-only ones.

## Split

Create new edge function `itinerary-ops/` that owns the "edit / read / repair" actions. `generate-itinerary` keeps only the heavy generation paths.

```text
generate-itinerary/ (stays)        itinerary-ops/ (new)
├── generate-trip                   ├── save-itinerary
├── generate-trip-day (v1+v2)       ├── repair-costs
├── generate-day                    ├── sync-tables
├── generate-full                   ├── toggle-lock
├── regenerate-day                  ├── get-itinerary
                                    └── get-trip
```

Both functions share `supabase/functions/_shared/` (unchanged) and re-use the same auth + rate-limit helpers (extracted into `_shared/itinerary-router.ts` so it stays one source of truth).

## Steps

1. **Extract shared router helpers** to `_shared/itinerary-router.ts`: `validateAuth`, `decodeJwtRole`, service-role bypass, rate-limit, proof-of-charge gate. No logic change — just moved.
2. **Create `supabase/functions/itinerary-ops/index.ts`** — thin dispatcher that imports the 6 action handlers above and uses the shared helpers. Add `[functions.itinerary-ops] verify_jwt = false` to `supabase/config.toml`.
3. **Slim `generate-itinerary/index.ts`** — remove the 6 extracted handler imports + their dispatch branches. Keep generation actions only.
4. **Re-route client calls** — every `supabase.functions.invoke('generate-itinerary', { body: { action: 'save-itinerary' | 'repair-costs' | 'sync-tables' | 'toggle-lock' | 'get-itinerary' | 'get-trip', ... } })` flips to `'itinerary-ops'`. Find/replace across `src/`, `supabase/functions/_shared/` (e.g. `safeUpdateItineraryData`, action executor, hooks).
5. **Deploy both functions** and smoke-test:
   - `itinerary-ops` with `get-itinerary` against an existing trip.
   - `generate-itinerary` with `get-itinerary`-replacement removed (returns 400 unknown action — that's the contract).
6. **Verify bundle sizes** by reading the deploy success response.

## Notes

- Files left in place; only `index.ts` for each function changes plus the new shared helpers module and the find/replace in callers.
- All RLS, auth, proof-of-charge, and rate-limit behavior preserved bit-for-bit (single shared module).
- No DB migration. No frontend UI changes.
- Risk: missed call site → that action 404s. Mitigated by repo-wide grep of every action string before deploy.
- Rollback: revert the client find/replace; the original `generate-itinerary` still has fallback router code in git if needed.
