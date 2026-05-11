# R4 — trip_collaborators PII lock

## Shipped

- New view `public.public_trip_collaborators` (security_barrier, SECURITY DEFINER, membership-filtered via `auth.uid()`):
  - exposes `id, trip_id, user_id, role (= permission), accepted_at, created_at, member_display, avatar_url`
  - hides `invited_by`, `include_preferences`
  - `GRANT SELECT TO authenticated`; `REVOKE SELECT FROM anon, PUBLIC`
- Base `trip_collaborators`:
  - dropped permissive `"Users can view relevant collaborations"` SELECT policy (the `is_trip_collaborator()` clause was the leak)
  - kept INSERT/UPDATE/DELETE policies untouched
  - added `trip_owner_collaborator_read` (owner sees all rows on their trips) + `self_collaborator_read` (each user sees their own row)
  - `REVOKE SELECT FROM anon, PUBLIC`
- Frontend:
  - `src/services/tripCollaboratorsAPI.ts::getTripCollaborators` rewritten: reads view for the member list, merges admin fields (`invited_by`, `include_preferences`) from the base table where RLS allows, fetches profiles separately. Owners get full data; peers get full member list + admin fields for their own row only.
  - `TripSuggestions.tsx` + `ProposeReplacementDialog.tsx` notification fan-out switched to the view.

## Verification

- `information_schema.views` row for `public_trip_collaborators` ✅
- Base table SELECT policies: only `trip_owner_collaborator_read` + `self_collaborator_read` ✅
- `anon` / `PUBLIC` have no SELECT on base table or view ✅
- Linter: 41 pre-existing warnings unchanged; 1 new ERROR (0010 Security Definer View) **accepted by design** — view is intentionally definer because the base table is fully locked and the view performs its own membership filter. Recorded in `@security-memory`.

## Not changed

- All edge functions (run as service role / owner — base table reads still work).
- `tripSharingAPI.ts` and other base-table call sites: every remaining client read either filters by `user_id = auth.uid()` (covered by `self_collaborator_read`) or runs from owner context (covered by `trip_owner_collaborator_read`). No further migration needed for them.
- INSERT/DELETE/UPDATE flows — unchanged.
