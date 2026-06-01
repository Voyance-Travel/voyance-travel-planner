
## Problem

`itinerary-integrity-contract.ts` emits `FINAL_ORPHAN_TRANSIT` when a transit card titled `"Walk/Taxi/Tram/... to X"` has no same-day non-logistics activity whose title/venue contains `X`. This is detected and reported, but **no repair step consumes the code**. The Dublin case shipped as "Taxi to The Shelbourne — 1 hr" with no Shelbourne activity scheduled after it.

A parallel detector exists in `validate-day.ts` (`ORPHANED_TRANSIT_NODE`, repair at repair-day.ts §1b) but it only **removes** the orphan; it doesn't re-point. And it runs *before* the §7/§8 injection steps that can add new targets, so it misses cases where the right answer is "the transit was correct, just mislabeled."

## Fix — new repair step `§8e. ORPHAN TRANSIT REPOINT/REMOVE`

Insert into `repair-day.ts` immediately after §8d (`RE-RUN DEPARTURE SEQUENCE AFTER INJECTIONS`), so it sees the final post-injection day shape. Runs for **every day**, not just departure days.

For each non-locked transit card `T` at index `i` whose title matches `TRANSIT_TARGET_RE` (`/^(walk|taxi|tram|bus|metro|train|cab|uber|drive|ride|head|transfer) to (.+)$/i`):

1. **Skip exemptions** (mirror integrity-contract):
   - Locked / user-pinned / manual / extracted.
   - Bookend-ish: `source` starts with `bookend-`, is `late_nightlife_bookend`, tag includes `hotel`/`hotel-return`/`rest`, or destination matches `\b(hotel|airport|station|terminal|port|home|accommodation|stay|apartment|residence|riad|ryokan|hostel|guesthouse|villa)\b`.

2. **Find next non-logistics activity** `N` in chronological order at index `j > i` (skip transit/transport/logistics rows and other bookends).

3. **Decide action**:
   - **Re-point** (preferred) when `N` exists, isn't a hotel/airport bookend, and starts within ±90 min of `T.endTime`:
     - Rewrite `T.title` / `T.name` to `"<Verb> to <N.title-or-venue>"` preserving the original verb (Walk/Taxi/...).
     - Update `T.transportation.to` (string or `{ name }`) to the resolved venue name.
     - Update `T.location.name` to match.
     - Set `T.metadata.transit_unverified = true` so the existing tight-transition health suppression applies (duration was LLM-guessed).
     - Stamp `T.source = 'repair-orphan-repoint'`.
     - Push repair `{ code: 'FINAL_ORPHAN_TRANSIT', action: 'repointed_orphan_transit', before, after }`.
   - **Remove** when:
     - No valid `N` exists after `T`, OR
     - `T` resolves to a hotel/return target that already occurred earlier in the day (a non-bookend hotel-return earlier in `activities`), OR
     - `N` exists but starts >90 min later AND there is no gap-filler between them (true dangling connector).
   - Splice and push `{ code: 'FINAL_ORPHAN_TRANSIT', action: 'removed_orphan_transit_no_target' }`.
   - Resort by `startTime` after any splice; iterate descending so indices stay valid.

4. **Always** log `[ORPHAN_TRANSIT_REPAIR] day=N idx=i action=… before="…" after="…"`.

5. After the loop, if any re-point fired, re-invoke the existing `recomputeTransitCards` from `_shared/timing-cascade.ts` on the day. Re-pointed cards now carry the real downstream venue name, so when coords exist (set by enrichment on `N`) the duration will be recomputed from real geometry — closing the "Taxi 1 hr for 10 min ride" inflation **without** a new airport-only special case. When coords are still missing, the `transit_unverified` stamp prevents the health panel from flagging a tight transition.

## Out of scope

- Touching `validate-day.ts` §ORPHANED_TRANSIT_NODE or its §1b repair (left as-is; covers the earlier-stage pure removal path; the new §8e is the late, post-injection, repoint-first net).
- Adding non-airport per-mode duration heuristics. Geometry-based `recomputeTransitCards` is the right path and is already wired; we just feed it correct destinations.
- Frontend changes — purely backend pipeline.

## Files touched

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add §8e block + small helper `isOrphanTransitTarget(t)` colocated above the step.
- `supabase/functions/generate-itinerary/pipeline/__tests__/orphan-transit-repoint.test.ts` — new test file:
  - re-point case: `Taxi to The Shelbourne` followed by `Lunch at Hugo's` → title becomes `Taxi to Hugo's`, `transit_unverified=true`.
  - remove case: `Walk to Cafe Chris` with no Cafe Chris on day → spliced.
  - exemption: `Walk to Hotel` left untouched.
  - hotel-already-returned: second `Taxi to The Shelbourne` after an earlier hotel-return → removed.

## Memory

Append a "Orphan-Transit Late Repair" subsection to `mem/constraints/itinerary/flight-anchor-truth-parity.md` noting:
- New §8e in repair-day runs after §8d for every day.
- Repoint-first, remove-fallback semantics.
- Sentinel `[ORPHAN_TRANSIT_REPAIR]`.
- Closes the `FINAL_ORPHAN_TRANSIT` detect-without-repair gap and feeds correct names into `recomputeTransitCards` so non-airport durations self-heal when coords are present.

## Verification

- Re-run on trip `ab83230a-…` (Dublin): "Taxi to The Shelbourne — 1 hr" should either re-point to the next real activity (and shrink once coords resolve) or be removed.
- All new + existing repair-day tests pass.
- Deploy `generate-itinerary` and tail logs for `[ORPHAN_TRANSIT_REPAIR]`.
