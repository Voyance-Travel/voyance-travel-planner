---
name: Final Commit Gate Is The Boundary
description: resolveCommitGate is sole authority for ready/frozen. Server hotel sync runs before HOTEL_COST_NOT_SURFACED. FINAL_ORPHAN_TRANSIT + executioner orphan drops. Flight anchor ±10m via isUserOwned. action-save-itinerary re-gates every edit. safeUpdateItineraryData strips client ready/frozen fields. Lint test blocks regressions.
type: constraint
---

# Final Commit Gate Is The Boundary

`resolveCommitGate` (`_shared/commit-itinerary.ts`) is the ONLY authority that may promote a trip to `ready`/`fully_persisted=true`/`itinerary_frozen_at`. To stop the Lisbon/Amsterdam class of "ships as ready with broken truth" bugs:

1. **Gate runs LAST, after every mutator**: `action-generate-trip-day` Phase 6 + `generation-core` Stage 6 both re-fetch on-disk `itinerary_data.days` and re-invoke `resolveCommitGate` AFTER table sync + activity_costs + must-do retry + sanitizeSchedule. If gate blocks, status is forced to `partial` and freeze is skipped entirely. Stamps `metadata.quality.final_gate_trace = {at, status, codes, site}`.

2. **System anchors are checkable**: `itinerary-integrity-contract.ts` `FLIGHT_ANCHOR_COMMIT_MISMATCH` + `AIRPORT_LOOP_ON_NON_DEPARTURE` use new `isUserOwned()` (not `isLocked()`). System anchors stamped `isLocked=true` by anchor-guard (arrival-flight, airport-transfer, generated check-in) ARE inspected; only truly user-touched/manual/imported/booked/pinned rows are immutable. Closes Lisbon 19:00 / Amsterdam 20:00 ships-as-ready when arrival truth was 21:00 / 22:00.

3. **Frontend cannot promote**: 4 TripDetail self-heal sites (stuck-heal, stale-generating, rebuild-from-tables, has-data) now write `partial` + stamp `metadata.quality.final_gate_bypassed=true` with site label, not `ready`. `setTrip(...)` local React state is fine. `safeUpdateItineraryData` is fine (routes through backend save-itinerary which runs the gate). Lint test `src/test/noRawReadyWrites.test.ts` blocks new violations.

4. **Must-do recognizes named experiences**: `assert-must-do-coverage.ts` adds aliases for Lisbon (`tram 28`, `belem tower`, `jeronimos`) + Amsterdam (`canal boat tour`, `anne frank house`, `rijksmuseum`, `van gogh`). `NAMED_TRANSIT_EXPERIENCE_RE` exempts tram/funicular/cable-car/ferry/canal-cruise from `NON_QUALIFYING_CATEGORY_RE` so "Tram 28 Ride" categorised as `transport` still satisfies the must-do.

5. **Regression fixture**: `_shared/__tests__/integrity-contract.amsterdam.test.ts` locks all four failure modes (flight mismatch, post-checkin loop, missing canal boat, priced hotel not surfaced) — fixture fails before fixes, passes after.

**Sentinels**: `[generate-trip-day] Phase 6 GATE BLOCKED ready` / `[Stage 6] Phase 6 GATE BLOCKED ready` / `[TripDetail] Stuck-heal: ... 'partial' (gate runs server-side)`.

**Success query**: `select count(*) from trips where itinerary_status='ready' and metadata->'quality'->>'final_gate_trace' is null` must trend to 0 for trips created after deploy.
