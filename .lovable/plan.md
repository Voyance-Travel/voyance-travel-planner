# Final Commit Gate — Phase 2 COMPLETE ✅

All six items shipped. See `mem://constraints/itinerary/final-commit-gate` for the live contract.

## Shipped

1. **Token-gated persistence** — `commit-token.ts` (HMAC-SHA256, content-hash bound, 5-min TTL, single-use). `persistTripItinerary` logs `[COMMIT_TOKEN] verified|rejected|missing` but the persist boundary re-runs the gate as the actual source of truth.
2. **Server-side hotel sync** — `ensureHotelCostRow` writes Day-0 hotel `activity_costs` row before `HOTEL_COST_NOT_SURFACED` runs. Frontend `useHotelLedgerSync` race closed.
3. **New blocking invariants**:
   - `FINAL_ORPHAN_TRANSIT` — "Walk to X" requires X within ±90 min; executioner drops orphans (`EXEC_ORPHAN_TRANSIT_DROPPED`).
   - `REQUIRED_USER_INTENT_MISSING` (pre-existing) covers canal-boat-tour class.
   - `FLIGHT_ANCHOR_COMMIT_MISMATCH` tightened to ±10m via `isUserOwned` (not `isLocked`).
4. **Frontend cleanup**:
   - `safeUpdateItineraryData` strips client-side `itinerary_status: ready/generated`, `metadata.itinerary_frozen_at`, `fully_persisted`, `fully_persisted_at` before invoking the backend save action.
   - `src/test/noRawReadyWrites.test.ts` blocks any new offender on those four fields.
5. **Edit-path re-gate** — `action-save-itinerary` always runs `resolveCommitGate`; user edits that re-break integrity drop status to `partial` and surface `metadata.integrity_contract`.
6. **Amsterdam fixture** — `_shared/__tests__/integrity-contract.amsterdam.test.ts` exercises all five Amsterdam failure modes plus the `hotelCostRowFound:true` bypass branch.

## Verification surface

- `[Stage 6] / [generate-trip-day] Phase 6 GATE BLOCKED ready`
- `[save-itinerary] GATE demoted to partial`
- `[safeUpdateItineraryData] stripped client-side …`
- `EXEC_ORPHAN_TRANSIT_DROPPED` in `metadata.quality.executioner_audit`
- DB: `select count(*) from trips where itinerary_status='ready' and metadata->'quality'->>'final_gate_trace' is null` → 0
