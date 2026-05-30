# Final Commit Gate — Phase 2 (Lock the Boundary)

Phase 1 moved the gate to the end of generation. Phase 2 makes it the **only** path to `ready` and closes the four remaining Amsterdam bugs at their structural source.

## What this fixes

1. **Flight-time mismatch** — arrival/departure anchors still drift because frontend self-heal paths can re-stamp `ready` without re-running the gate.
2. **Post-arrival airport loop** — executioner drops it, but legacy/edit writes can re-introduce it without re-validation.
3. **Must-do omission** ("canal boat tour") — coverage is checked but not enforced as a persist-blocker on edit paths.
4. **Hotel payment exclusion** — hotel cost row is written by the frontend after `ready`, so the gate never sees it.
5. **Orphan transit** ("Walk to Cafe Chris" with no Cafe Chris) — no invariant exists yet.

## Plan

### 1. Token-gated persistence (the real lock)
- `persistTripItinerary` requires `commitToken` (signed `{tripId, contentHash, gateVersion, issuedAt}`) to write `itinerary_status='ready'` or `metadata.itinerary_frozen_at`.
- Only `finalizeTripForCommit` mints tokens (after gate passes). Tokens are single-use, 5-min TTL, content-hash bound — editing the days after minting invalidates the token.
- Writes without a token may set `partial`/`generating`/`failed` only. No `allowFrozenWrite` escape hatch — it's removed.

### 2. Hotel/payment sync moves server-side
- `finalizeTripForCommit` writes the Day-0 hotel `activity_costs` row itself, *before* running `HOTEL_COST_NOT_SURFACED`.
- Frontend `useHotelLedgerSync` becomes read-only (observe + warn, never write). Closes the race where the gate ran before the hotel row existed.

### 3. New blocking invariants
- `FINAL_ORPHAN_TRANSIT`: every "Walk/Taxi/Tram to X" must have a non-bookend activity whose venue/title matches X within ±90 min on the same day. Otherwise drop the transit (executioner) and re-validate.
- `FINAL_MUST_DO_MISSING`: missing must-do (after `injectMissingMustDos`) is now blocking, not just a health warning. Forces `partial` + surfaces in TripHealthPanel with a "Regenerate Day N" CTA.
- `FINAL_FLIGHT_ANCHOR_MISMATCH`: tightened to ±10m (was 20m) for system anchors; user-owned anchors still exempt.

### 4. Frontend cleanup (close the bypass surface)
- All 8 direct `itinerary_status` writers audited; none may write `ready`. Lint rule `noRawReadyWrites` extended to block `frozen_at` writes too.
- `safeUpdateItineraryData` strips `ready`/`frozen_at` from caller payloads unless `commitToken` is present and verifies server-side.
- Self-heal sites (`self-heal-chronology`, `self-heal-predawn-cascade`, `self-heal-rebuild-from-tables`, version-restore) keep prior status; never promote.

### 5. Edit-path re-gate
- `action-save-itinerary` runs `finalizeTripForCommit` on every user save when the prior status was `ready`. If it now fails, status drops to `partial` and a toast surfaces the blocking codes.

### 6. Amsterdam regression fixture
- Extend `integrity-contract.amsterdam.test.ts` with the live trip fingerprint:
  - flight 09:55 vs anchor 10:38 → FINAL_FLIGHT_ANCHOR_MISMATCH
  - airport transfer at 12:30 on arrival day → AIRPORT_LOOP_ON_NON_DEPARTURE
  - "Walk to Cafe Chris" with no Cafe Chris activity → FINAL_ORPHAN_TRANSIT
  - "canal boat tour" not present → FINAL_MUST_DO_MISSING
  - hotel $200×3 not in `activity_costs` → HOTEL_COST_NOT_SURFACED
- Assert: gate returns 5 codes, status stays `partial`, no token issued.

## Technical notes

- `commitToken`: HMAC-SHA256 over `tripId|sha256(canonical-days-json)|gateVersion|issuedAt`, secret `COMMIT_GATE_SECRET` (new edge secret).
- Token verification in `persistTripItinerary` recomputes the content hash from the payload — caller can't swap days between mint and persist.
- `gateVersion` lets us invalidate all in-flight tokens on contract changes.

## Files

- `supabase/functions/_shared/commit-itinerary.ts` — mint token, hotel sync, tighten anchor tolerance
- `supabase/functions/_shared/persist-itinerary.ts` — token verification, strip ready/frozen from un-tokened writes
- `supabase/functions/_shared/itinerary-integrity-contract.ts` — add FINAL_ORPHAN_TRANSIT, promote FINAL_MUST_DO_MISSING to blocking
- `supabase/functions/_shared/schedule-executioner.ts` — drop orphan transits
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` — re-gate on edit
- `src/lib/itinerary/safeUpdateItineraryData.ts` — strip ready/frozen client-side
- `src/hooks/useHotelLedgerSync.ts` — read-only mode
- `src/test/noRawReadyWrites.test.ts` — extend to frozen_at
- `supabase/functions/_shared/__tests__/integrity-contract.amsterdam.test.ts` — full fixture
- new mem entry: `mem://constraints/itinerary/commit-token-required-for-ready`
