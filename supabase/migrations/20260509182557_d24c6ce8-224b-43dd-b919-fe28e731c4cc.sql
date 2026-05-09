-- Collaborator INSERT + DELETE for trip_activities
-- Background: migration 20260302124656 added SELECT and UPDATE policies for
-- edit-permission collaborators but omitted INSERT and DELETE, leaving them
-- able to view and modify existing activities but unable to add or remove them.
-- Owner INSERT policy from 20260118135000 stays unchanged. Postgres RLS OR's
-- all policies — both can coexist.
-- The is_trip_collaborator(_, _, true) helper requires permission ∈
-- {'edit','admin'} AND accepted_at IS NOT NULL — view-only collaborators
-- remain blocked from INSERT/DELETE.

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