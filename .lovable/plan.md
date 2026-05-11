## Live enumeration result

Ran the audit query against the live DB. **31 SECURITY DEFINER functions** in `public` are currently executable by `authenticated` (and 6 also by `anon`). After cross-referencing every one against frontend `supabase.rpc(...)` call sites, edge-function call sites, and the function bodies themselves, here is the classification:

### A — Service-only / unused: REVOKE from PUBLIC + authenticated, GRANT to service_role

| Function | Why |
|---|---|
| `add_to_group_budget(uuid, integer)` | Only called from edge fns (`topup-group-budget`, `stripe-webhook`) |
| `deduct_credits_fifo(uuid, integer)` | Only called from edge fns (`spend-credits`, `generate-travel-guide`, `purchase-group-unlock`, `topup-group-budget`) |
| `spend_from_group_budget(uuid, integer)` | No frontend callers; service path |
| `consume_free_edit(uuid)` | No callers anywhere; legacy / unreachable |
| `get_intake_account(text)` | No callers anywhere |
| `get_journey_trips(uuid)` | No callers anywhere; multi-trip journeys query goes through other paths |

### B — Frontend-callable, internal `auth.uid()` check VERIFIED: keep current grants

These already enforce identity inside the function body (confirmed by `prosrc ILIKE '%auth.uid()%'` audit + manual read):

`accept_trip_invite`, `complete_quiz`, `get_user_id_by_email`, `get_user_info_by_email`, `get_trip_permission`, `optimistic_update_itinerary`, `resolve_or_rotate_invite`, `save_onboarding_dna` (both 6-arg and 7-arg overloads), `toggle_consumer_trip_share`, `transition_booking_state`, `update_collaborator_permission`, `get_current_user_email`.

### C — Frontend-callable, intentionally anon: keep `anon` + `authenticated`

| Function | Why public is OK |
|---|---|
| `get_consumer_shared_trip(text)` | Public share-link reader; gated by share_token + share_enabled flag |
| `get_shared_trip_payload(text)` | Same pattern, agency share view |
| `get_trip_invite_info(text)` | Pre-auth invite landing page (read-only, token-gated) |
| `get_founding_member_count()` | Public marketing counter |
| `get_platform_destination_count()` | Public marketing counter |
| `get_platform_trip_count()` | Public marketing counter |
| `submit_client_intake(...)` | Pre-auth client-intake form, token-validated inside body |

### D — RLS policy helpers: keep `authenticated` grant (used inside policy USING/WITH CHECK)

`is_trip_owner(uuid)`, `is_trip_collaborator(uuid, uuid, boolean)`, `is_trip_member(uuid, uuid)`, `get_user_trip_ids(uuid)`. Revoking these would break RLS evaluation across the trips/collaborators stack.

### E — MUST FIX: callable by `authenticated` but missing internal auth check

| Function | Action |
|---|---|
| `claim_first_trip_benefit(p_user_id uuid)` | Add internal `IF auth.uid() <> p_user_id THEN RAISE EXCEPTION 'unauthorized'` guard. Without it, any signed-in user can claim a benefit on behalf of another `p_user_id`. Keep grants after fix. |

## Migration

Single migration `revoke_public_security_definer_grants` performing:

1. **Revoke + grant service_role** for the 6 Group A functions:
   ```sql
   REVOKE EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer) FROM PUBLIC, authenticated, anon;
   GRANT  EXECUTE ON FUNCTION public.add_to_group_budget(uuid, integer) TO service_role;
   -- ...repeat for the other 5
   ```

2. **Patch `claim_first_trip_benefit`** to add the `auth.uid() = p_user_id` guard (CREATE OR REPLACE FUNCTION with the existing body + new guard at top).

3. **No changes to** Group B/C/D — they are correctly exposed.

## Verification

After migration runs:
- Re-run the enumeration query; the 6 Group A functions disappear from results.
- Frontend smoke test: ensure no UI path calls Group A functions (already audited: zero `supabase.rpc('add_to_group_budget'…)` etc. in `src/`).
- Edge functions (`topup-group-budget`, `stripe-webhook`, `spend-credits`, `generate-travel-guide`, `purchase-group-unlock`) all use the service-role client → unaffected.
- Re-run `supabase--linter` and confirm the SECURITY DEFINER public-execution warning count drops by 6.
- Manual test: hit "claim first trip benefit" path on a real signup; confirm it still succeeds for the legitimate user, and a curl with another user's `p_user_id` raises `unauthorized`.

## Out of scope

- Not touching auth schema or storage schema functions.
- Not switching any function from SECURITY DEFINER to SECURITY INVOKER (would require RLS audit per function — separate task).
- Not removing the `postgres` / `sandbox_exec*` superuser grants (those exist on every function and are not a security boundary).