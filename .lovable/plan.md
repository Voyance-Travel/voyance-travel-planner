# Final Commit Gate — Phase 3 COMPLETE ✅

Phases 1 & 2 shipped previously. Phase 3 wires the commit token end-to-end and makes verification enforcing.

## Phase 3 shipped

1. **Upstream token forwarding** — All 3 ready-claim sites now forward the minted token to `persistTripItinerary({ commitToken })`:
   - `generation-core.ts` Stage 6 final save
   - `action-generate-trip-day.ts` Phase 6 final persist
   - `action-save-itinerary.ts` user edit save
2. **Strict-mode enforcement** — `persistTripItinerary` reads env `COMMIT_TOKEN_STRICT`. When `true`, a ready/generated/frozen claim that lacks an authenticated token is **pre-demoted to `partial`** (and freeze stamps stripped) before the redundant re-gate runs. Catches any future bypass of `resolveCommitGate`.
3. **Content-drift tolerance** — Persist mutates `days` internally (sanitizeSchedule, timing cascade, predawn normalize). Strict mode accepts tokens that pass signature/trip/TTL but fail content-hash (logged as `content-drift`). Real content tamper still rejected.
4. **Audit stamp** — Every ready-claim write stamps `metadata.quality.commit_token_audit = { result, reason?, ageMs?, strict, enforced? }` so rollout is queryable without parsing logs.
5. **Tests** — `_shared/__tests__/commit-token-enforcement.test.ts` (6 tests): mint/verify round-trip, tampered-days rejection, audit stamping (missing + verified), strict-mode demote on missing, strict-mode allow on verified. All passing.

## Rollout

Currently `COMMIT_TOKEN_STRICT` is unset → enforcement off, audit on. To enable:
1. Query `select metadata->'quality'->'commit_token_audit'->>'result', count(*) from trips where itinerary_status='ready' group by 1` after a few days.
2. When `verified` dominates, set `COMMIT_TOKEN_STRICT=true` via secrets tool.

## Verification surface

- `[COMMIT_TOKEN] verified|authenticated|rejected|missing`
- `[COMMIT_TOKEN_STRICT_DEMOTE]`
- DB: `select count(*) from trips where itinerary_status='ready' and metadata->'quality'->'commit_token_audit'->>'result' = 'missing'` → trends to 0 after deploy.
