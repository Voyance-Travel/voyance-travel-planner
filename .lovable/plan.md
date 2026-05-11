# X1 — Service-only table lockdown (5 tables)

## Problem
Linter flagged `stripe_webhook_log` for relying on Postgres default-deny rather than an explicit policy. Same shape as W2 (`customer_review_contacts`). Four sibling cache/log tables created in the same batch share the issue. All five are server-only by design — no frontend or non-service-role caller exists.

## Pre-deploy verification (already done)
`rg` for `from('<table>')` shows:
- 0 matches in `src/` (frontend never touches these — good)
- All matches in `supabase/functions/` use service-role clients (`supabaseAdmin` / `idemSupabase`) — safe under the new policy because service_role bypasses RLS

Affected files (read-only, no changes needed):
- `stripe-webhook/index.ts` (3 calls)
- `itinerary-chat/index.ts` (2 calls)
- `lookup-destination-insights/index.ts` (2 calls)
- `generate-travel-intel/index.ts` (2 calls)

## Migration

Single migration applying both layers to all 5 tables:
1. `stripe_webhook_log`
2. `chat_idempotency_cache`
3. `destination_insights_cache`
4. `google_places_search_cache`
5. `travel_intel_locks`

For each table:
- `REVOKE ALL ... FROM anon, authenticated, PUBLIC` — strips inherited grants
- `CREATE POLICY "<table>_deny_non_service" AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)` — RESTRICTIVE is AND-ed with permissive policies, so a future accidental permissive policy still cannot expose data

service_role policies + grants from prior migrations remain untouched (service_role bypasses RLS).

DO-block loop over the table array for both steps.

## Verification (post-migration)

A. Grants check — expect 0 rows:
```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('stripe_webhook_log','chat_idempotency_cache','destination_insights_cache','google_places_search_cache','travel_intel_locks')
  AND grantee IN ('anon','authenticated','PUBLIC');
```

B. Policy presence — expect 2 rows per table (1 PERMISSIVE service_role + 1 RESTRICTIVE deny):
```sql
SELECT tablename, policyname, permissive
FROM pg_policies
WHERE tablename IN ('stripe_webhook_log','chat_idempotency_cache','destination_insights_cache','google_places_search_cache','travel_intel_locks')
ORDER BY tablename, policyname;
```

C. Re-run `supabase--linter` — `stripe_webhook_log` finding resolved + 3 sibling warnings (`chat_idempotency_cache`, `destination_insights_cache`, `google_places_search_cache`) also clear.

D. Functional sanity: stripe-webhook insert path + itinerary-chat idempotency upsert continue to work (service_role bypasses RLS).

## Memory

Create `mem://constraints/security/service-only-tables`:
> Five tables are service-role-only: `stripe_webhook_log`, `chat_idempotency_cache`, `destination_insights_cache`, `google_places_search_cache`, `travel_intel_locks`. Each has (1) RLS enabled, (2) permissive `Service role full access` policy for service_role, (3) RESTRICTIVE deny policy for anon + authenticated, (4) no table-level GRANTs to anon/authenticated/PUBLIC. Any new service-only cache/log table MUST follow this pattern. Frontend must never `supabase.from(...)` these tables.

Add Core index line referencing the new memory.

Mark security finding `stripe_webhook_log_no_authenticated_read` (and the 3 sibling cache warnings) as fixed.

## Out of scope
The other security findings in the panel (trip_intents INSERT, send-push no-auth, AI endpoints no-auth, activities/transfer-pricing no-auth, trip_notifications JWT-claim check, agency_documents visibility) — separate fixes, not part of this migration.
