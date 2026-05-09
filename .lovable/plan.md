## Fix 5.1 — INSERT (and DELETE) policy for edit collaborators on `trip_activities`

**Problem:** Migration `20260302124656` granted edit collaborators SELECT + UPDATE on `trip_activities` but omitted INSERT/DELETE — so collaborators with edit permission can't add or remove activities on a shared trip.

**Helper verified** (migration `20260119182913`): `is_trip_collaborator(trip_id, auth.uid(), true)` requires `accepted_at IS NOT NULL` AND `permission ∈ {'edit','admin'}` — view-only collaborators stay blocked.

**New migration** adds two policies (Postgres OR's policies, so this composes with the existing owner INSERT policy from `20260118135000`):

```sql
CREATE POLICY "Collaborators with edit can insert trip activities"
ON public.trip_activities
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_trip_collaborator(trip_id, auth.uid(), true)
);

CREATE POLICY "Collaborators with edit can delete trip activities"
ON public.trip_activities
FOR DELETE
TO authenticated
USING (
  public.is_trip_collaborator(trip_id, auth.uid(), true)
);
```

**Verification:**
- `ls supabase/migrations/ | grep collaborator_insert_delete` → new file exists
- `grep -rn "Collaborators with edit can (insert|delete) trip activities" supabase/migrations/` → both policies present
- Manual: sign in as edit collaborator on a shared trip → "Add activity" succeeds (previously failed with permission denied).