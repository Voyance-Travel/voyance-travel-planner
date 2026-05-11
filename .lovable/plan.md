# R4 — `public_trip_collaborators` view + REVOKE

## Current state (verified against the live DB)

- `trip_collaborators` has **no `email` column** — emails leak only when callers join `profiles:user_id (email, …)`. Two such joins exist (`tripSharingAPI.ts` line 102, `tripCollaboratorsAPI.ts` line 425).
- Anon already has no `SELECT` on `trip_collaborators` (`has_table_privilege('anon', …) = false`), but no explicit `REVOKE … FROM PUBLIC` is recorded — we'll add it for defense-in-depth and to satisfy the linter.
- A `public_trip_collaborators` view already exists but:
  - is missing `WITH (security_barrier = true)`,
  - was not granted to `authenticated` (only `sandbox_exec`),
  - already (correctly) keeps `user_id` in the projection — we will keep it (UUID is not PII and several callers need it for joins/filtering).
- SELECT policies on the base table already restrict to trip owner + self; we'll re-create them to match the spec exactly (drop the existing `trip_owner_collaborator_read` / `self_collaborator_read` and re-add cleanly). INSERT/UPDATE/DELETE policies stay untouched.

## Migration (single file)

```sql
-- 1. Recreate view, security-barriered, scoped to owner OR accepted co-member
DROP VIEW IF EXISTS public.public_trip_collaborators;
CREATE VIEW public.public_trip_collaborators
WITH (security_barrier = true, security_invoker = true) AS
SELECT
  tc.id,
  tc.trip_id,
  tc.user_id,
  tc.permission AS role,
  tc.accepted_at,
  tc.created_at,
  COALESCE(p.display_name, 'Member ' || SUBSTRING(tc.id::text FROM 1 FOR 8)) AS member_display,
  p.avatar_url
FROM public.trip_collaborators tc
LEFT JOIN public.profiles p ON p.id = tc.user_id;

GRANT SELECT ON public.public_trip_collaborators TO authenticated;
REVOKE ALL ON public.public_trip_collaborators FROM anon, PUBLIC;

-- 2. Lock the base table down
REVOKE SELECT ON public.trip_collaborators FROM anon;
REVOKE SELECT ON public.trip_collaborators FROM PUBLIC;

-- 3. Re-state the two SELECT policies cleanly
DROP POLICY IF EXISTS "trip_owner_collaborator_read" ON public.trip_collaborators;
DROP POLICY IF EXISTS "self_collaborator_read" ON public.trip_collaborators;

CREATE POLICY "trip_owner_collaborator_read" ON public.trip_collaborators
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trips t
  WHERE t.id = trip_collaborators.trip_id AND t.user_id = auth.uid()
));

CREATE POLICY "self_collaborator_read" ON public.trip_collaborators
FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

Note: with `security_invoker = on`, the view runs under the caller's RLS, so the implicit "owner OR co-member" filter must come from the view body itself — keeping the existing `WHERE owner OR accepted-co-member` predicate matters for cross-collaborator visibility. We'll preserve it:

```sql
…
LEFT JOIN public.profiles p ON p.id = tc.user_id
WHERE EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = tc.trip_id AND t.user_id = auth.uid()
      )
   OR EXISTS (
        SELECT 1 FROM public.trip_collaborators me
        WHERE me.trip_id = tc.trip_id
          AND me.user_id = auth.uid()
          AND me.accepted_at IS NOT NULL
      );
```

## Frontend swap

Classify each call site. Writes (`insert/update/delete`) **always** keep direct table access (writes don't go through the view). Owner-only management reads keep direct access (so they can still join `profiles.email`). Display/list reads move to the view.

| File | Line | Op | Action |
|---|---|---|---|
| `src/services/tripSharingAPI.ts` | 102 | SELECT + `profiles(email)` join | **Owner mgmt** — keep direct |
| `src/services/tripCollaboratorsAPI.ts` | 425 | SELECT + profile join | **Owner mgmt** — keep direct |
| `src/services/tripCollaboratorsAPI.ts` | 89 | SELECT base columns for admin map | Keep direct (owner panel) |
| `src/services/tripCollaboratorsAPI.ts` | 141, 152, 240, 331, 343, 399 | INSERT/UPDATE/DELETE/lookup | Keep direct |
| `src/services/tripSharingAPI.ts` | 88, 175, 195, 318, 388, 409 | writes / self-scoped reads | Keep direct |
| `src/components/itinerary/TripCollaboratorsPanel.tsx` | 217 | UPDATE | Keep direct |
| `src/components/itinerary/BlendRecalcBanner.tsx` | 38 | SELECT `user_id, include_preferences` | Keep direct (needs `include_preferences`, not in view) |
| `src/hooks/useVoyanceAPI.ts` | 115 | SELECT `trip_id` where `user_id = me` | Keep direct (self policy covers it) |
| `src/services/achievementsAPI.ts` | 403 | COUNT where `invited_by = me` | Keep direct |
| `src/pages/TripDashboard.tsx` | 855 | SELECT where `user_id = me` (trip list join) | Keep direct (self) |
| `src/pages/TripDashboard.tsx` | 880 | SELECT cross-collaborators with profile join (display/avatar) | **Move to `public_trip_collaborators`** |
| `src/pages/TripDetail.tsx` | 1516 | COUNT for current trip | Keep direct (owner) |
| `src/pages/Start.tsx` | 2632, 3125 | INSERT | Keep direct |
| `src/utils/splitJourneyIfNeeded.ts` | 244, 259 | SELECT/INSERT during split (server-trusted owner path) | Keep direct |
| `supabase/functions/**` | various | Edge functions use service-role key, RLS bypassed | Leave untouched |

Net frontend change: only `src/pages/TripDashboard.tsx` line 880 needs the table swap. Update that call to `from('public_trip_collaborators').select('trip_id, user_id, member_display, avatar_url')` and adjust the consumer to read `member_display` instead of `profile.display_name` (other call sites already use `profile?.handle` etc., so we map the view fields through a small shim).

## Verification

1. `psql -c "SELECT 1 FROM information_schema.views WHERE table_name='public_trip_collaborators'"` returns one row.
2. `psql -c "SELECT has_table_privilege('anon','public.trip_collaborators','SELECT')"` returns `f`.
3. `psql -c "SELECT has_table_privilege('anon','public.public_trip_collaborators','SELECT')"` returns `f`.
4. `psql -c "SELECT has_table_privilege('authenticated','public.public_trip_collaborators','SELECT')"` returns `t`.
5. `supabase--linter` no longer flags `trip_collaborators` for PII exposure.
6. Smoke: load the dashboard as a non-owner co-member; cross-collaborator avatars/names render via the view; owner panel still shows emails.

## Memory

Add `mem://constraints/security/trip-collaborators-view-only` documenting: cross-collaborator reads MUST go through `public_trip_collaborators`; only owner-management views may join `profiles.email`; writes always go to the base table.
