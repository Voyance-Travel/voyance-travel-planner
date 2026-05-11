# Lock down `trip_members.email` PII (R5 — mirror R4 pattern)

## Problem
Any accepted collaborator on a trip can `SELECT * FROM trip_members WHERE trip_id = X` and read every other member's email. Same shape as R4 (`trip_collaborators` → `public_trip_collaborators`).

## Solution: 2-layer lockdown

### Layer 1 — Migration

```sql
-- 1. Email-projecting view (security_barrier + security_invoker)
CREATE OR REPLACE VIEW public.public_trip_members
WITH (security_barrier = true, security_invoker = on) AS
SELECT
  tm.id, tm.trip_id, tm.user_id, tm.name, tm.role, tm.joined_at,
  COALESCE(p.display_name, tm.name,
           'Member ' || SUBSTRING(tm.id::text FROM 1 FOR 8)) AS member_display,
  p.avatar_url
  -- intentionally NO email, NO phone
FROM public.trip_members tm
LEFT JOIN public.profiles p ON p.id = tm.user_id
WHERE EXISTS (SELECT 1 FROM public.trips t
              WHERE t.id = tm.trip_id AND t.user_id = auth.uid())
   OR EXISTS (SELECT 1 FROM public.trip_members me
              WHERE me.trip_id = tm.trip_id AND me.user_id = auth.uid());

GRANT SELECT ON public.public_trip_members TO authenticated;
REVOKE ALL ON public.public_trip_members FROM anon, PUBLIC;

-- 2. Tighten base table SELECT — owner OR self only
DROP POLICY IF EXISTS "Users can view members of their trips" ON public.trip_members;
DROP POLICY IF EXISTS "Users can view trip members" ON public.trip_members;

CREATE POLICY "Trip owner sees all members" ON public.trip_members
FOR SELECT TO authenticated
USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));

CREATE POLICY "Self sees own membership row" ON public.trip_members
FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

INSERT/UPDATE/DELETE policies remain untouched.

### Layer 2 — Frontend caller audit

`grep` found 2 src files + 1 util + 2 edge fns hitting `trip_members`. Classification:

| File | Lines | Class | Action |
|---|---|---|---|
| `src/services/tripBudgetAPI.ts` getTripMembers L86–106 | reads `email` for split-bill display | **CROSS-MEMBER w/ email need** | Special — see below |
| `src/services/tripBudgetAPI.ts` add/update/remove/count L116, 167, 183, 196, 202, 228, 302, 415 | OWNER-ish writes + counts | keep direct (writes need real table; counts work for owner+self → still fine for solo-trip guard) |
| `src/services/tripCollaboratorsAPI.ts` L192, 247, 349, 400 | upsert/delete sync | OWNER WRITE | keep direct |
| `src/utils/splitJourneyIfNeeded.ts` L269, 283 | journey-leg propagation insert | OWNER WRITE | keep direct |
| `supabase/functions/.../action-generate-trip.ts` L353 | server-side `user_id` list | EDGE FN (service role) | keep direct |
| `supabase/functions/.../compile-prompt.ts` L875, L1072 | server-side count + user_ids | EDGE FN (service role) | keep direct |

**Only one true cross-member-display read in the client: `getTripMembers` in `tripBudgetAPI.ts`.** It is consumed by PaymentsTab/EditorialItinerary to render the member roster + assign payments. It currently reads `email`.

#### `getTripMembers` refactor (the only client swap)
Switch the SELECT to `public_trip_members`, drop `email` from the projected `TripMember` row in this read path. Trip owners managing members via the invite UI use a separate path (`addTripMember` write + RPC); they don't need the email back from this list — the UI displays `name || member_display`. The single use of `member.email` as a name fallback (L671 in `getMemberBalances`) is replaced by `member.name || member_display || 'Member'`.

`TripMember.email` type stays optional to avoid a wide refactor; the field will just be `undefined` for non-owner reads. Owner-management UIs that genuinely need to display invited-but-unaccepted emails (if any) can continue to call `from('trip_members')` directly under the new owner-policy. We will grep for `member.email` UI references to confirm none break — preliminary check shows only the L671 fallback.

### Verification
- Owner: `select email from trip_members where trip_id=X` → all rows, emails present
- Non-owner collaborator: same query → only own row
- Non-owner: `select * from public_trip_members where trip_id=X` → all members, NO email column
- Anon: both → 0 rows
- Run `supabase--linter` — `trip_members.email` exposure finding clears

### Memory
Append `mem://constraints/security/trip-members-pii-isolation` and reference in index Core (mirrors `Trip Collaborators View-Only`).

## Out of scope
- `email` column itself stays (writes/upserts use it as a uniqueness key on `(trip_id, email)` for unaccepted invites)
- No edge-function changes (already service-role)
- No PaymentsTab UI logic changes beyond the name-fallback line