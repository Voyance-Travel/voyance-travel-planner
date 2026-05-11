# M6 + R4 Implementation Plan (with reviewer notes incorporated)

## M6 — Budget tracker: missing `activity_costs` writes on per-day chain

### Root cause (confirmed)
Two generator paths exist; only `generation-core.ts` (legacy whole-trip) writes `activity_costs`. The current default `action-generate-trip-day.ts` (per-day chain) never calls the writer, so `BudgetTab → snapshot.tripTotalCents → resolveCanonicalCostRows({ costs: activity_costs })` reads an empty/sparse table and renders $0 / "$160 vs $3,600 in cards" drift.

### Three-layer fix

**Layer 1 — Backend writer parity (source-of-truth fix for new trips)**
- Extract Phase 4 of `generation-core.ts` Stage 6 into a new shared helper `supabase/functions/_shared/activity-costs-writer.ts` exporting `writeActivityCostsFromItinerary(supabase, tripId, days, travelers)`.
- Call it from `action-generate-trip-day.ts` after the per-day table sync (same point where transit/cost normalization completes), and replace the inline call in `generation-core.ts` with the shared helper.
- Sentinel: `[writeActivityCostsFromItinerary] Wrote N rows for trip=…`.

**Layer 2 — Frontend rescue (display correctness for legacy trips, no DB write)**
- Add a `json-missing-row` rescue branch in `resolveCanonicalCostRows` (`src/lib/payments/resolveCanonicalCostRows.ts`): when an itinerary activity has a price but no matching `activity_costs` row, synthesize an in-memory canonical row from the JSON.
- **Reviewer note 1 (confirm in code):** Rescued rows MUST carry `isPaid: false` and `source: 'json-rescue'`. Add an explicit assertion + unit test that no rescue path ever writes `isPaid: true` (would falsely trigger payment-flow filters in `usePayableItems` / `PaymentsTab`). Display-only until Layer 1/3 catches up.

**Layer 3 — One-shot auto-backfill (DB heals over time)**
- New edge function `supabase/functions/sync-trip-cost-table/index.ts` that re-invokes `writeActivityCostsFromItinerary` for a single trip.
- `useTripFinancialSnapshot` invokes it once per session **per trip** when canonical total = $0 but live JSON has prices.
- **Reviewer note 2 (fingerprint guard):** The `lastBackfillFingerprint` ref MUST be keyed `${tripId}:${jsonPriceHash}`, not a global session flag. A user with 3 legacy trips opening all 3 in the same session must trigger 3 backfills. Add a unit test asserting the second `tripId` is not skipped after the first fires.
- Sentinel: `[useTripFinancialSnapshot] auto-backfilled activity_costs for legacy trip=…`.

### Tests
- Unit: writer parity (per-day chain output matches whole-trip output for a fixture trip).
- Unit: rescue rows always `isPaid: false`.
- Unit: backfill fingerprint scoped per `tripId`.
- Manual: regenerate one fresh trip (verify `activity_costs` populated) + open one pre-existing legacy trip (verify rescue displays correct total immediately, then backfill fires once, then refresh shows canonical rows).

### Memory
Update `mem://constraints/finance/activity-costs-write-parity` to note the per-trip fingerprint contract and `isPaid: false` rescue invariant.

---

## R4 — `public_trip_collaborators` view hardening

### Scope (narrowed after live-DB verification)
Base table `trip_collaborators` is already locked from anon. View already exists. Real changes are minimal:

1. **Migration:** Add `security_barrier = true` + `security_invoker = on` to the existing `public_trip_collaborators` view; recreate with the dual-EXISTS WHERE (owner OR accepted co-member); `GRANT SELECT` to `authenticated`; ensure base table has `trip_owner_collaborator_read` + `self_collaborator_read` SELECT policies and is REVOKEd from anon/PUBLIC.
2. **Frontend:** Single-line swap in `src/components/TripDashboard.tsx:880` from `trip_collaborators` → `public_trip_collaborators` for the cross-collaborator display read. All other call sites (writes, owner email-join management, self-scoped reads) stay on the base table — verified one-by-one.

### Reviewer concern — profiles RLS probe (BLOCKING gate before merge)
The view's `LEFT JOIN public.profiles p` under `security_invoker = on` respects caller RLS on `profiles`. If `profiles` only allows self-reads, names fall through `COALESCE` to `'Member abc12345'` placeholders.

**Pre-merge probe (will run via `supabase--read_query` before applying the migration):**
```sql
-- Pick a real (userA, userB) pair that share an accepted trip_collaborators row.
-- Simulate userA's view of userB:
SELECT id, display_name, avatar_url
FROM public.profiles
WHERE id = '<userB_id>';
-- Then check current RLS:
SELECT polname, polqual::text
FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass;
```

**Decision tree:**
- If `display_name` is readable for co-collaborators → ship as planned.
- If RLS blocks it → add a companion migration with a `profiles_collaborator_read` policy: `SELECT` allowed when `EXISTS (collaborator pair where current user and target user share at least one accepted trip_collaborators row, in either direction)`. Limit exposed columns by view projection (already only `display_name`, `avatar_url`).

### Tests
- SQL: assert `has_table_privilege('anon', 'trip_collaborators', 'SELECT') = false`.
- SQL: assert view returns rows for owner + accepted co-member, zero rows for unrelated user.
- App: TripDashboard displays real `display_name` for collaborators (not `Member abc12345`).

### Memory
Extend `mem://constraints/security/trip-collaborators-view-only` with the `security_barrier + security_invoker` rationale and note that profiles RLS may need a companion `profiles_collaborator_read` policy depending on probe result.

---

## Order of operations
1. Run profiles RLS probe (R4 gate) — read-only.
2. Land M6 Layer 1 (writer extraction + per-day call) — migration-free.
3. Land M6 Layer 2 (rescue) + Layer 3 (auto-backfill edge fn + hook) — migration-free.
4. Land R4 migration (view + grants, plus optional profiles policy if probe failed).
5. Land R4 frontend 1-line swap.
6. Run full vitest + manual QA on one fresh trip + one legacy trip + one collaborator-shared trip.
