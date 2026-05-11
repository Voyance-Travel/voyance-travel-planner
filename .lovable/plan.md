# Ship Queue: 5 Approved Plans + Reviewer Notes

All five plans approved with specific reinforcing notes. Consolidating into one execution plan.

## 1. Hotel-Return Bookend (Florence/Barcelona nightcap days)

**Leak A — Pre-dawn strip eats fresh bookend:**
- Tag late-nightlife bookends with `source: 'late_nightlife_bookend'` at emission in `runStep8` / accommodation builder.
- Update `stripPreDawnHotelReturns` to skip rows where `source === 'late_nightlife_bookend'` (single change inherits to all 5 call sites: universal-quality-pass, action-save-itinerary, action-sync-tables, persist-day, action-generate-trip-day).

**Leak B — Retry gate semantic:**
- Set `metadata.quality.step8_deferred = true` when Step 8 defers due to required-but-missing dinner.
- Gate post-meal-guard retry on `step8_deferred && lacksHotelReturn(day)` instead of `mealsInjected > 0`.

**Reviewer note (added):** Add unit test asserting `source: 'late_nightlife_bookend'` tag survives a full pipeline pass (repair-day → terminalCleanup → save normalization → persist). If any downstream pass strips/rewrites the source field on accommodation cards, the 5-site strip-skip becomes a no-op.

## 2. Q43 SECURITY DEFINER REVOKE + Group A–E Classification

Single migration containing:

**Group A (revoke from authenticated → service_role only):** functions only called from edge functions / triggers.

**Group B (keep grants, verified internal auth):** `get_user_id_by_email`, `get_user_info_by_email`, `get_intake_account` (already hardened in prior round).

**Group C (keep, intentional public surface):** sign-up flows, public lookups already documented.

**Group D (keep, RLS policy helpers):** `is_trip_owner`, `is_trip_collaborator`, `is_trip_member`, `get_user_trip_ids` — revoking breaks RLS evaluation. Document as accepted.

**Group E (fix in same migration):** `claim_first_trip_benefit` — add `IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'forbidden'; END IF;` before benefit grant. New privilege-escalation finding; do **not** defer.

**Reviewer note (added):** Before merging, do a 30-second source read of `get_user_id_by_email` and `get_user_info_by_email` to confirm `auth.uid()` is identity-restrictive (e.g., admin-role check or caller=subject), not just an incidental reference. Already hardened to `has_role('admin')` in prior round per memory — re-verify in current `prosrc`.

## 3. M1 Round 2 — Clause-Level Phantom-Ref Scrub

**Gap A — Clause splitting:** In `scrubPhantomEventRefs`, split on `;`, `—`, `–` in addition to sentence terminators before phantom detection. Drop early-return on `parts.length < 2`.

**Single-segment phantom blanking:** If entire field is just the phantom ref (≤14 words AND <3 meaningful tokens after stripping phantom phrase), blank the field. New validation-gate code `DESCRIPTION_GHOST_REFERENCE` force-blanks residuals.

**Gap B — Prompt-side ground-truth injection:** In `prompt-library.ts` SCHEDULE COHERENCE block, inject the day's actual schedule (start time, title, neighborhood) as ground truth with HARD RULE forbidding references to non-listed activities.

**Reviewer note (added):** Schedule context block must be deterministic. Stable sort by `(startTime, activityId)` before building the schedule text, so retries with identical inputs produce identical ground truth and the coherence rule retains force.

**Telemetry:** Start `DESCRIPTION_GHOST_REFERENCE` as soft warn (no forced regen). Promote to forced regen only if production leak rate warrants.

## 4. M3 Round 2 — Extract `detectGapsForDay`

Refactor only — no behavior change beyond the M3 round 1 fix already shipped.

- Extract the inline 200-line `forEach` from `TripHealthPanel.tsx` into a named module-level `detectGapsForDay(allActivities, dayNumber)` (already done in M3 round 1 per memory; this round adds the safety invariants).
- **Step 1 of function MUST be the day-boundary filter** — invariant impossible to violate via future edits.
- Explicit guard: never emit a gap before the first sorted activity of the day (no synthetic `prevEnd = 0` anchor).
- Belt-and-braces: secondary `startMins < firstSubstantiveStart` filter after sort to catch wrap-past-midnight cards that slip the wrap filter.

**Regression sentinel test:** "Day 3 first activity 08:30 with no prior → no gap emitted." Fails immediately if synthetic anchor is re-introduced.

## 5. M4 Round 2 — Luxury-Tier Walk Threshold

- Add `isLuxuryTier(budgetTier)` helper (single source of truth, returns true for `luxury | luminary | splurge | premium`).
- `walkThresholdsFor(budgetTier)` already returns tier-aware `{ maxWalkMin, maxWalkMeters }` per memory — confirm luxury bucket = `20 min / 1000 m`, standard = `30 min / 1500 m`.
- Repair `§15b` uses `pickTransitTier` (haversine, no Google Directions calls — respects centralization constraint).
- Repair logs include tier: `[WALK_OVER_THRESHOLD] day=N tier=luxury dist=… mins=…`.

**Tests (both directions):**
- Luxury 25-min / 1.2 km walk → flagged → upgraded to transit
- Luxury 8-min / 600 m (Plaza Mayor → Mercado San Miguel) → passes
- Standard 25-min / 1.2 km → does NOT flag (below universal cap)
- Standard 35-min / 1.6 km → flagged by universal cap

**Reviewer note (logged):** Reviewer formally retracts prior "defer luxury sub-cap" advice from M4 round 1. Universal cap and luxury sub-cap catch disjoint case classes; both ship.

## Execution Order

1. Q43 migration (Groups A revoke + Group E `claim_first_trip_benefit` guard, with B/D source re-verification first).
2. Hotel-return Leak A (source tag + strip skip) + Leak B (`step8_deferred` flag + retry gate) + pipeline-survival unit test.
3. M1 round 2 (clause split + prompt-side schedule injection with stable sort + `DESCRIPTION_GHOST_REFERENCE` validation code).
4. M3 round 2 safety invariants + regression sentinel test.
5. M4 round 2 luxury tier helper + bidirectional tests.
6. Full vitest + Deno test runs.
7. Memory updates (one entry per item, condensed).

## Out of Scope

Madrid-style QA on a fresh city, final linter rerun, Stripe E2E manual config, beta-2 — all post-ship verification, handled in follow-up rounds.
