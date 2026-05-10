## Goal
Close two scanner findings:
1. **SECURITY DEFINER functions executable by anon/authenticated** — lock down the ones that are never meant to be called directly from the client.
2. **Public bucket allows listing** — stop anon `list()` enumeration of the 4 public buckets while keeping `getPublicUrl()` downloads working.

## Audit results

I enumerated every `prosecdef=true` function in `public` and every `.rpc(...)` call across `src/` and `supabase/functions/`. Each function falls into one of four buckets:

### A. Client-callable (KEEP anon+authenticated EXECUTE) — auth-checked internally or used by share-link/invite flows
`accept_trip_invite`, `archive_orphan_trip_payments`, `expire_stale_trip_payments`, `claim_first_trip_benefit`, `complete_quiz`, `consume_free_edit`, `get_consumer_shared_trip`, `get_shared_trip_payload`, `get_trip_invite_info`, `get_intake_account`, `get_trip_permission`, `get_user_id_by_email`, `get_user_info_by_email`, `get_user_trip_ids`, `get_current_user_email`, `get_founding_member_count`, `get_platform_destination_count`, `get_platform_trip_count`, `get_journey_trips`, `get_unit_economics_summary` (admin-checked inside), `insert_user_audit_log`, `optimistic_update_itinerary`, `rescue_orphan_cost_row`, `is_trip_owner`, `is_trip_member`, `is_trip_collaborator`, `generate_invoice_number`, `bump_venue_usage`.

### B. Edge-function-only (REVOKE anon+authenticated, keep service_role)
Called only from edge functions running with the service-role key:
`add_to_group_budget`, `bump_archetype_guide_usage`, `bump_places_cache_hit`, `deduct_credits_fifo`, `fulfill_credit_purchase`, `increment_daily_usage`, `increment_user_usage`, `insert_audit_log`, `award_founding_member`.

### C. Trigger-only (REVOKE anon+authenticated)
These are bound to AFTER/BEFORE triggers; nothing should call them directly:
`handle_new_user`, `handle_new_user_free_tier`, `notify_trip_members_on_join`, `prevent_permission_self_escalation`, `prevent_self_collaboration`, `prune_itinerary_versions_per_trip`, `increment_itinerary_version`, `generate_booking_reference`.

### D. Cron / admin-only (REVOKE anon+authenticated)
`cleanup_expired_search_cache`, `cleanup_old_itinerary_versions`, `cleanup_rate_limits`, `cleanup_stale_intel_locks`, `reconcile_credit_balances`.

`reconcile_credit_balances` and `insert_audit_log` already have no anon/auth EXECUTE — they'll be no-ops, but included for explicitness.

## Plan

### Step 1 — Migration: revoke EXECUTE on B/C/D functions

For each function listed in groups B, C, D:
```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(<args>) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.<fn>(<args>) TO service_role;
```

Group A is left untouched. Trigger functions in group C keep firing normally — trigger execution does not check EXECUTE privilege of the invoking role.

### Step 2 — Migration: stop anonymous listing of public buckets

Buckets affected: `avatars`, `destination-images`, `guide-photos`, `site-images`. Codebase only ever uses `getPublicUrl()` on these (no `.list()` calls), so revoking the broad `storage.objects` SELECT policy is safe — direct public-URL fetches bypass `storage.objects` RLS and continue to work.

```sql
DROP POLICY "Avatar images are publicly accessible"        ON storage.objects;
DROP POLICY "Destination images are publicly accessible"   ON storage.objects;
DROP POLICY "Public read access for guide photos"          ON storage.objects;
DROP POLICY "Public read access for site images"           ON storage.objects;
```

(No replacement SELECT policy is needed for `storage.objects`. Public URLs continue to serve files because the storage API serves them directly for `public=true` buckets without consulting `storage.objects` RLS. The existing INSERT/UPDATE/DELETE owner policies on these buckets stay in place.)

### Step 3 — Verify

- `psql` as anon: `select * from storage.objects where bucket_id='avatars'` → 0 rows.
- Curl a known public URL (e.g. an avatar) → still 200 OK.
- Anon `rpc('fulfill_credit_purchase', ...)` → 42501 permission denied.
- Authenticated `rpc('get_trip_permission', ...)` → still works.
- Edge function with service-role key → still works for all B/D functions.
- Stripe webhook fulfillment path: confirm `fulfill_credit_purchase` is invoked via service role (it is — `supabase/functions/stripe-webhook`).

### Files touched
- One new SQL migration. No frontend or edge-function code changes — group A keeps the same surface and groups B/C/D are already invoked with the service-role key or via triggers.
