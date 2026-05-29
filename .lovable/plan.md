## Conclusion

The root issue is now clear: the new “commit gate” exists, but it is not actually the final compiler. It is currently an advisory validator that can be bypassed or invalidated after it runs.

The Amsterdam QA proves four concrete failures in the current implementation:

1. **Gate runs too early**: in `action-generate-trip-day`, `resolveCommitGate()` runs before later mutators (`sanitizeSchedule`, table sync, activity-cost write, must-do DB coverage). The itinerary can pass the gate, then be changed, then still freeze as ready.
2. **Gate skips system-locked flight anchors**: `itinerary-integrity-contract.ts` uses `isLocked()` and skips arrival cards with `isLocked=true`, even though those are system anchors, not user-owned. This is why the 8 PM/10 PM mismatch can still ship.
3. **Must-do check is non-blocking after persist**: post-DB must-do coverage can log `MUST_DO_UNCOVERED`, but it does not demote `finalStatus` before Phase 6 freezes the trip.
4. **Ready/freeze writes still bypass the gate**: `TripDetail.tsx` has several direct `itinerary_status: 'ready'` / `fully_persisted: true` self-heal paths. `persistTripItinerary` does not reject ready writes without a gate result.

So the one true conclusion is: **we have not yet moved the boundary.** We added checks, but the final status transition is still distributed.

## Implementation Plan

### 1. Replace “commit gate” with a true final compiler

Create/upgrade one final function, e.g. `finalizeTripForCommit`, that runs after every mutation and returns:

```ts
{
  days,
  status: 'ready' | 'partial' | 'failed',
  metadataPatch,
  canFreeze: boolean,
  codes
}
```

It must be the only function that decides:

- `itinerary_status='ready'`
- `metadata.fully_persisted=true`
- `metadata.itinerary_frozen_at`

Unlike the current `resolveCommitGate`, it must run **after**:

- schedule sanity
- executioner
- must-do injection
- title coherence
- table sync readiness checks
- activity cost write / hotel ledger sync

### 2. Move the gate to the actual end of generation

In `action-generate-trip-day.ts`:

- Stop calling `resolveCommitGate()` before `sanitizeSchedule` and before post-persist coverage.
- Run all final mutations first.
- Re-read the persisted itinerary JSON after final persist/table sync.
- Run `finalizeTripForCommit()` on the DB-visible days.
- If any blocking code remains, update the trip as `partial` and never run Phase 6 freeze.
- If ok, then and only then stamp `ready + fully_persisted + frozen`.

This directly fixes the current pattern where `MUST_DO_UNCOVERED` logs but Phase 6 still freezes.

### 3. Add a hard ready-write guard to `persistTripItinerary`

Update `persistTripItinerary` so any `extraUpdate` attempting to write:

- `itinerary_status: 'ready' | 'generated'`
- `metadata.fully_persisted: true`
- `metadata.itinerary_frozen_at`

must include a valid internal gate result/token from `finalizeTripForCommit`.

Without that token, downgrade to `partial` and stamp:

```ts
metadata.quality.final_gate_bypassed = true
```

This prevents future frontend/self-heal paths from silently promoting bad trips.

### 4. Remove frontend direct ready promotions

Patch `TripDetail.tsx` and related client paths so page-load/self-heal logic never writes `ready` directly.

Replace with one of:

- `partial` for recovered-but-not-finalized trips
- backend `save-itinerary`/commit path for user-triggered saves
- local UI state only, without DB promotion

The frontend must not be able to freeze or certify a paid itinerary.

### 5. Fix flight truth as a first invariant

Update the integrity contract to use the same lock distinction as the Executioner:

- user/manual/booked/imported/pinned = immutable
- system anchors (`arrival-flight`, `airport-transfer`, generated check-in/out) = repairable and checkable

Then enforce:

- arrival card start/end must match entered arrival truth within tolerance
- if mismatch is repairable, repair it before commit
- if not repairable, block ready with `FINAL_FLIGHT_ANCHOR_MISMATCH`

Also fix `flight-leg-pick` / flight context so a connecting leg cannot be selected as destination arrival unless its airport matches the trip destination.

### 6. Fix impossible logistics and orphan transit at commit

Add final deterministic passes before certification:

- Drop Day 1 post-check-in hotel return loops.
- Drop airport transfers on middle days.
- On departure day, if no departure clock truth exists, do not fabricate checkout/airport transfer as a complete day.
- Drop transit cards whose destination activity does not exist, e.g. “Walk to Cafe Chris” with no Cafe Chris stop.
- Clamp or remove unverified transfer durations over 180 minutes.

Blocking codes:

- `FINAL_AIRPORT_LOOP_DROPPED`
- `FINAL_ORPHAN_TRANSIT_DROPPED`
- `FINAL_DEPARTURE_TRANSFER_WITHOUT_CLOCK`
- `FINAL_TRANSFER_DURATION_CLAMPED`

### 7. Make must-do coverage a blocking commit invariant

Fix the matcher and the timing:

- Add named transit experiences to must-do coverage: `Tram 28`, `Canal boat tour`, funiculars, cable cars, route/line-number activities.
- Do not disqualify user-requested transit experiences just because their category is `transport`.
- Add Amsterdam/Lisbon aliases: `canal boat tour`, `canal cruise`, `boat tour`, `tram 28`, `eléctrico 28`.
- Run coverage on the DB-visible final itinerary, not only in-memory days.
- If missing after injection, status must be `partial`, not ready.

Blocking code:

- `FINAL_MUST_DO_MISSING`

### 8. Regenerate/rewrite day titles after final drops/injections

Move day-title coherence after must-do injection and logistics drops.

Remove the current low-signal escape hatch that accepts titles with no activity overlap. A title like “Tram Rides & Farewells” must be rewritten if no tram/canal/boat activity exists on that day.

Code:

- `FINAL_DAY_TITLE_REWRITTEN` as non-fatal metadata
- no fabricated title references allowed in a ready trip

### 9. Make hotel/payment truth part of commit

Move hotel ledger sync out of fragile frontend load effects and into backend commit finalization.

Fix these known payment causes:

- `syncHotelToLedger` must compute real nights, not depend on a one-shot frontend effect.
- Remove/replace `budgetSyncedRef` so hotel changes sync reliably.
- Single-city hotel save must sync when `pricePerNight` exists even without `totalPrice`.
- Logistics upsert should key on deterministic `activity_id`, not category/day only.
- Archived manual hotel payments must not delete the canonical hotel row.
- `resolveCanonicalCostRows` must not rescue stale transport rows onto walking legs or $0 transit placeholders.

Commit invariant:

- if selected hotel has a real price, Payments/header/day totals must share one canonical total.
- “Free” must never be shown for a priced hotel; if excluded, label it “Excluded”.

Blocking code:

- `FINAL_HOTEL_COST_NOT_SURFACED`
- `FINAL_PAYMENT_TOTAL_MISMATCH`

### 10. Add one Amsterdam/Lisbon regression fixture that must fail before and pass after

Create a single fixture containing:

- arrival truth 22:00 but generated arrival 20:00
- check-in followed by “Return to Hotel”
- “Walk to Cafe Chris” with no Cafe Chris activity
- departure transfer with no departure flight clock
- missing “Take a canal boat tour”
- hotel $200/night × 3 excluded from Payments
- Payments tab/header/line-item mismatch

Assertions:

- before repair: finalizer returns `partial` with exact final-gate codes
- after repair: finalizer returns `ready`
- no trip can be `ready` without `metadata.quality.final_gate_trace`

### 11. Add a grep/lint guard for future regressions

Add a test that fails if any code outside the finalizer writes:

- `itinerary_status: 'ready'`
- `fully_persisted: true`
- `itinerary_frozen_at`

Allowed exceptions must be explicitly listed and should be near-zero.

## Success Criteria

After implementation, this query must be true for newly generated trips:

```sql
select count(*)
from trips
where itinerary_status = 'ready'
  and metadata->'quality'->>'final_gate_trace' is null;
-- must be 0
```

And for the Amsterdam fixture:

- no flight-time mismatch ships as ready
- no post-check-in hotel loop ships as ready
- no orphan transit node ships as ready
- no missing canal boat must-do ships as ready
- no priced hotel appears as Free
- Payments “Matches itinerary” only appears when the canonical totals actually match