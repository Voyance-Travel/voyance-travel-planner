---
name: Final Commit Gate Is The Boundary
description: resolveCommitGate sole authority for ready/frozen. Server hotel sync, FINAL_ORPHAN_TRANSIT, ±10m flight anchor via isUserOwned, edit-path re-gate, client promotion strip, noRawReadyWrites lint. Phase 3: commit token forwarded from gen Stage 6 / gen-trip-day Phase 6 / save-itinerary into persistTripItinerary; COMMIT_TOKEN_STRICT env pre-demotes ready→partial when caller bypassed gate; content-drift tolerated; audit at metadata.quality.commit_token_audit.
type: constraint
---

# Final Commit Gate Is The Boundary

`resolveCommitGate` (`_shared/commit-itinerary.ts`) is the ONLY authority that may promote a trip to `ready`/`fully_persisted=true`/`itinerary_frozen_at`. To stop the Lisbon/Amsterdam class of "ships as ready with broken truth" bugs:

1. **Gate runs LAST, after every mutator**: `action-generate-trip-day` Phase 6 + `generation-core` Stage 6 both re-fetch on-disk `itinerary_data.days` and re-invoke `resolveCommitGate` AFTER table sync + activity_costs + must-do retry + sanitizeSchedule. If gate blocks, status is forced to `partial` and freeze is skipped entirely. Stamps `metadata.quality.final_gate_trace = {at, status, codes, site}`.

2. **System anchors are checkable**: `itinerary-integrity-contract.ts` `FLIGHT_ANCHOR_COMMIT_MISMATCH` + `AIRPORT_LOOP_ON_NON_DEPARTURE` use new `isUserOwned()` (not `isLocked()`). System anchors stamped `isLocked=true` by anchor-guard (arrival-flight, airport-transfer, generated check-in) ARE inspected; only truly user-touched/manual/imported/booked/pinned rows are immutable. Closes Lisbon 19:00 / Amsterdam 20:00 ships-as-ready when arrival truth was 21:00 / 22:00.

3. **Frontend cannot promote**: 4 TripDetail self-heal sites (stuck-heal, stale-generating, rebuild-from-tables, has-data) now write `partial` + stamp `metadata.quality.final_gate_bypassed=true` with site label, not `ready`. `setTrip(...)` local React state is fine. `safeUpdateItineraryData` is fine (routes through backend save-itinerary which runs the gate). Lint test `src/test/noRawReadyWrites.test.ts` blocks new violations.

4. **Must-do recognizes named experiences**: `assert-must-do-coverage.ts` adds aliases for Lisbon (`tram 28`, `belem tower`, `jeronimos`) + Amsterdam (`canal boat tour`, `anne frank house`, `rijksmuseum`, `van gogh`). `NAMED_TRANSIT_EXPERIENCE_RE` exempts tram/funicular/cable-car/ferry/canal-cruise from `NON_QUALIFYING_CATEGORY_RE` so "Tram 28 Ride" categorised as `transport` still satisfies the must-do.

5. **Regression fixture**: `_shared/__tests__/integrity-contract.amsterdam.test.ts` locks all five failure modes (flight mismatch ±10m, post-checkin loop, missing canal boat, priced hotel not surfaced, orphan transit) + `hotelCostRowFound:true` bypass.

6. **Phase 2 additions** (2026-05-30):
   - **Server hotel sync**: `ensureHotelCostRow` in `resolveCommitGate` writes the Day-0 hotel `activity_costs` row directly before integrity checks. Frontend `useHotelLedgerSync` is observe-only; the race where gate ran before the row existed is closed.
   - **FINAL_ORPHAN_TRANSIT invariant**: "Walk/Taxi/Tram to X" requires a non-bookend activity matching X within ±90 min same day. Otherwise dropped by `schedule-executioner` (`pruneOrphanTransits`, counter `orphanTransitsDropped`, code `EXEC_ORPHAN_TRANSIT_DROPPED`) and re-validated.
   - **Edit-path re-gate**: `action-save-itinerary` always invokes `resolveCommitGate` — if a user edit re-breaks integrity, status drops to `partial` and `metadata.integrity_contract` carries the verdict.
   - **Client promotion strip**: `safeUpdateItineraryData` silently scrubs `itinerary_status: 'ready'|'generated'`, `metadata.itinerary_frozen_at`, `metadata.fully_persisted`, `metadata.fully_persisted_at` from any caller's `extraUpdate` before invoking the backend.

**Sentinels**: `[generate-trip-day] Phase 6 GATE BLOCKED ready` / `[Stage 6] Phase 6 GATE BLOCKED ready` / `[save-itinerary] GATE demoted to partial` / `[safeUpdateItineraryData] stripped client-side …` / `EXEC_ORPHAN_TRANSIT_DROPPED`.

**Success query**: `select count(*) from trips where itinerary_status='ready' and metadata->'quality'->>'final_gate_trace' is null` must trend to 0 for trips created after deploy.
---

## Phase 3 (2026-05-30)

- **Token forwarding**: `resolveCommitGate` mints token on verdict.ok. All 3 sites pass it via `persistTripItinerary({ commitToken })`.
- **Strict enforcement**: env `COMMIT_TOKEN_STRICT=true` → ready/generated/frozen claims without an authenticated token are pre-demoted to `partial` (freeze stamps stripped) BEFORE the re-gate. Re-gate still authoritative.
- **Content-drift tolerance**: persist mutates `days` internally; signature+trip+TTL match is sufficient. Pure content tamper (no other gate fields valid) still rejected.
- **Audit**: `metadata.quality.commit_token_audit = { result: 'verified'|'rejected'|'missing'|'verify-error', reason?, ageMs?, strict, enforced? }`.
- **Tests**: `_shared/__tests__/commit-token-enforcement.test.ts` — 6 pass.
- **Sentinels**: `[COMMIT_TOKEN] verified|authenticated|rejected|missing`, `[COMMIT_TOKEN_STRICT_DEMOTE]`.
