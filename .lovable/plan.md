## Scope

Three approved items: R5 (verify-only), M2 (departure-day logistics refined), M6 round 2 (coverage-based auto-backfill trigger + sync-trip-cost-table category audit).

---

## R5 — parse-* auth gate (no-op verify)

**Goal:** Confirm all four parse-* edge functions reject unauthenticated requests and accept authed ones. No code changes expected.

**Steps:**
1. `supabase--curl_edge_functions` against each of: `parse-booking-confirmation`, `parse-document-text`, `parse-travel-story`, `parse-trip-input`.
   - Unauth call (explicit empty Authorization header) → expect 401.
   - Authed call (preview session) → expect 200 / 4xx-validation (anything not 401).
2. Confirm each function imports from `_shared/require-auth.ts` (quick `rg`).
3. If all pass: close R5, no migration, no memory entry.
4. If any single function fails: spot-fix only that function by wiring `require-auth.ts` (smallest possible diff). No broad refactor.

**Deliverable:** Verification log in chat. No file changes if green.

---

## M2 — Departure-day logistics (refined, single source of truth)

**Goal:** Eliminate the Madrid failure shape (21:05 checkout + untimed airport transfer + post-midnight dinner) by aligning §8/§8b with one deterministic helper instead of layering a contradictory pass.

**Steps:**

1. **Extract** `enforceDepartureDayLogistics(day, tripCtx)` into `supabase/functions/_shared/departure-day.ts`. Pure function, returns mutated day + ops log.
   - Computes checkout time = `min(11:00, dep − buffer − transferMins − 60)` (existing rule).
   - Inserts/repositions airport transfer ending at `dep − buffer`.
   - **Marks the airport transfer with `subcategory: 'airport_transfer'`** as the immutability sentinel.
   - Hard-prunes any non-locked, non-logistics card whose `startTime ≥ transfer.startTime` (covers the post-midnight dinner case explicitly; wrap-past-midnight times treated as "after transfer" via the same `parseTime` wrap rule used in TripHealthPanel).

2. **Replace** the existing logic inside `repair-day.ts` §8 (checkout retime) and §8b (transfer retime) with calls to the shared helper. Remove the per-pass ad-hoc patching so there is no tug-of-war.

3. **Guard the realignment pass:** in the final transport-realignment step (§15c / `repair-transports`), short-circuit any card where `subcategory === 'airport_transfer'` — do not recompute its timing as a venue-to-venue walk.

4. **Save-time safety net:** in `action-save-itinerary` `normalizeDays`, run a lightweight `pruneNonLogisticsAfterAirportTransfer(day)` after `pruneNonLogisticsAfterCheckout`. Defense-in-depth only; repair-day remains the contract.

5. **Tests** (`supabase/functions/generate-itinerary/__tests__/departure-day-logistics.test.ts`):
   - 13:30 flight, 90m buffer, 30m transfer → checkout 09:15–10:00, transfer ends 12:00.
   - No flight info → checkout 11:00, no synthetic transfer, nothing scheduled after 12:00.
   - Madrid shape: 21:05 checkout + untimed transfer + 22:10–24:25 dinner → checkout retimed earlier, transfer timed against flight, dinner pruned.
   - Realignment pass run after helper → airport_transfer timing unchanged.

6. **Memory:** update `mem://constraints/itinerary/departure-day-final-enforcement` to reference the shared helper + `subcategory: 'airport_transfer'` sentinel.

---

## M6 round 2 — Coverage-based auto-backfill + sync audit

**Goal:** Fix the trigger gap exposed by Madrid (hotel row exists → round-1 trigger never fires → dining/activities stay unwritten) AND verify the backfill function actually writes the full category set.

**Steps:**

1. **Audit `sync-trip-cost-table`:** read the function and confirm it iterates **every day** and calls `writeActivityCostsFromItinerary` (which writes dining + activity + transit + hotel + flight). If it currently scopes to a subset of categories or only Day 0, widen it to the full set. Add a unit test asserting all categories with non-zero JSON price are written.

2. **Replace the trigger condition** in `useTripFinancialSnapshot` (`src/hooks/useTripFinancialSnapshot.ts`):
   ```ts
   const pricedJsonIds = new Set(/* ids of JSON activities with price > 0 */);
   if (pricedJsonIds.size === 0) return; // no priced activities → no gap
   const uncoveredPriced = [...pricedJsonIds].filter(id => !canonicalIds.has(id));
   const coverageRatio = 1 - uncoveredPriced.length / pricedJsonIds.size;
   if (coverageRatio < 0.5 && fingerprintChanged) {
     console.warn(`[useTripFinancialSnapshot] activity_costs coverage ${(coverageRatio*100).toFixed(0)}% for trip ${tripId} (uncovered=${uncoveredPriced.length}) — triggering backfill`);
     fire backfill;
   }
   ```
   - Guard `pricedJsonIds.size > 0` precedes the ratio check.
   - Reuse the per-trip fingerprint (`${tripId}:${sortedPricedJsonIds}`) from round 1 so re-runs don't loop.

3. **Diagnostic field:** add `pricedJsonRescueCents` to the snapshot return object — sum of cents resolved via the in-memory JSON rescue path. Surfaced in dev-only debug panel and grepable in logs.

4. **Tests:**
   - Madrid shape (180,000¢ canonical, 8 priced JSON rows uncovered, coverage ~11%) → backfill fires.
   - 1 missing row out of 20 (95% coverage) → backfill does NOT fire.
   - Zero priced JSON activities → backfill does NOT fire (no division-by-zero, no spurious call).
   - Two trips opened in same session → both fire independently (per-trip fingerprint).

5. **Memory:** update `mem://constraints/finance/activity-costs-write-parity` with the coverage-ratio rule and the `pricedJsonRescueCents` diagnostic.

---

## Order of execution

1. R5 verification curls (parallel, fast) → if green, close.
2. M6 round 2 step 1 (audit `sync-trip-cost-table`) — blocking gate; if it doesn't write full category set, fix that BEFORE shipping the broadened trigger.
3. M6 round 2 steps 2–4 (trigger + tests).
4. M2 helper extraction → repair-day rewire → realignment guard → save-time net → tests.
5. Full vitest + Deno test pass.
6. Memory updates last.

## Out of scope

- Remaining items in the 17-item queue.
- Q43 watch-list source reads (`get_user_id_by_email`, `get_user_info_by_email`, `get_intake_account`) — already shipped in earlier round.
- Linter rerun (separate follow-up after this batch lands).
