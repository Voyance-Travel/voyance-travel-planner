## Goal

Stop `trip_collaborators` from leaking peer identity (and via FK-join, peer profile/email surface) to non-owner trip members. Enforce: owner sees full base table, each user sees only their own row, peers see other members **only** through a PII-free view.

## Two issues with the spec as written

Before shipping I need to flag two things in the SQL you pasted — the migration will fail or silently mis-secure as-is:

1. **`tc.role` doesn't exist.** The column is `permission` (text). Columns are: `id, trip_id, user_id, permission, invited_by, accepted_at, created_at, include_preferences`. I'll use `tc.permission AS role` in the view (keeps the API name you want).
2. **The existing SELECT policy is not named `trip_owner_collaborator_read`.** It's `"Users can view relevant collaborations"` and its third OR-clause `is_trip_collaborator(trip_id, auth.uid())` is exactly what currently lets peers read each other. The migration must `DROP` that policy (plus any stale variants) before creating the two new ones, otherwise the permissive peer-read survives and the lock is cosmetic.

Also worth noting: the `member_display` fallback `'Member ' || SUBSTRING(p.id::text, 1, 8)` exposes the first 8 chars of the profile UUID (== user_id). If the goal is to fully hide identity from peers, swap to `SUBSTRING(tc.id::text, 1, 8)` (the row id, not the user id). I'll go with row id unless you say otherwise.

## Migration

One migration file:

```sql
-- 1. View (security_barrier, joins profiles for display only — no email, no user_id)
CREATE OR REPLACE VIEW public.public_trip_collaborators
WITH (security_barrier = true) AS
SELECT
  tc.id,
  tc.trip_id,
  tc.permission AS role,
  tc.accepted_at,
  tc.created_at,
  COALESCE(p.display_name, 'Member ' || SUBSTRING(tc.id::text FROM 1 FOR 8)) AS member_display,
  p.avatar_url
FROM public.trip_collaborators tc
LEFT JOIN public.profiles p ON p.id = tc.user_id;

GRANT SELECT ON public.public_trip_collaborators TO authenticated;
REVOKE SELECT ON public.public_trip_collaborators FROM anon, PUBLIC;

-- 2. Lock base table
REVOKE SELECT ON public.trip_collaborators FROM anon, PUBLIC;

-- 3. Drop ALL existing SELECT policies on the base table
DROP POLICY IF EXISTS "Users can view relevant collaborations" ON public.trip_collaborators;
DROP POLICY IF EXISTS "trip_owner_collaborator_read" ON public.trip_collaborators;
DROP POLICY IF EXISTS "self_collaborator_read" ON public.trip_collaborators;

-- 4. Recreate as owner-only + self-only
CREATE POLICY "trip_owner_collaborator_read" ON public.trip_collaborators
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t
                 WHERE t.id = trip_collaborators.trip_id AND t.user_id = auth.uid()));

CREATE POLICY "self_collaborator_read" ON public.trip_collaborators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
```

INSERT/UPDATE/DELETE policies untouched.

## Frontend impact (real, non-trivial)

42 call sites across `src/` and `supabase/functions/`. They split cleanly:

**Safe to leave on base table** (owner context or self-row only):
- All edge functions in `supabase/functions/generate-itinerary/*` and `regenerate-on-blend-change` — these run in trip-owner or service-role context, both of which can still read the base table.
- `src/services/tripCollaboratorsAPI.ts` lines 303/315/371/397 (delete + own-row reads).
- All `INSERT` / `DELETE` / `UPDATE` call sites (policies untouched).
- Self-membership lookups (e.g. `BlendRecalcBanner.tsx`, `useVoyanceAPI.ts`, `TripDashboard.tsx:855/880`, `Start.tsx:2632/3125`, `TripDetail.tsx:1516`, `splitJourneyIfNeeded.ts:244`) — these filter by `user_id = current user`, so `self_collaborator_read` covers them. **No change needed**, just verify each.

**Must move to `public_trip_collaborators`** (peer-list reads from a non-owner viewer):
- `src/services/tripCollaboratorsAPI.ts` lines 73 + 125 — list-members for the trip detail panel. These currently embed `profile:profiles!...(id, handle, display_name, avatar_url)`; the view already inlines `member_display + avatar_url`, so the embed is dropped.
- `src/services/tripSharingAPI.ts` lines 89/102/176/195/319/389/410 — audit each; the ones that render member lists for non-owners switch to the view.
- `src/components/itinerary/TripCollaboratorsPanel.tsx:217` — peer-visible member list → view.
- `src/components/suggestions/TripSuggestions.tsx:203`, `ProposeReplacementDialog.tsx:90` — peer-context reads → view.
- `src/services/achievementsAPI.ts:403` — verify context, likely view.

For each switched site I'll: drop `user_id` references (view doesn't expose it), drop the `profile:profiles!fk(...)` embed (view inlines it), rename `permission` → `role` reads. Owner-only flows stay on the base table because the view strips `user_id`/`invited_by`/`include_preferences` they need.

I will **not** touch RPCs, INSERT paths, or anything that already filters by `user_id = auth.uid()`.

## Verification (after apply)

1. `SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='public_trip_collaborators';` → 1 row
2. `SET ROLE anon; SELECT * FROM public.trip_collaborators LIMIT 1;` → permission denied
3. As a non-owner collaborator: `SELECT * FROM trip_collaborators WHERE trip_id = <shared_trip>;` returns only their own row; same query on `public_trip_collaborators` returns all members (display + avatar only).
4. Run `supabase--linter`; the `trip_collaborators`/profile-email exposure finding should drop off.
5. Manually open the trip-collaborators panel as a non-owner peer in preview to confirm the members list still renders names + avatars.

## Deliverables

- 1 migration (above).
- Edits to ~6 frontend files routing peer-context reads through `public_trip_collaborators` (drop `profiles` embed, drop `user_id` field references, rename `permission` → `role`).
- Verification report (linter + the 5 checks above).

## Questions before I implement

1. Confirm `member_display` fallback should use **row id** (`tc.id`) not **user id** (`p.id`) — i.e. fully hide user_id from peers. Recommended: yes.
2. The view exposes `permission` as `role`. OK to keep this rename, or prefer `permission` to match the column?
