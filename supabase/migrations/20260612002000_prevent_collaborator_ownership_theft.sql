-- SECURITY FIX (bug 19): an edit-permission collaborator could STEAL or DELETE
-- a trip shared with them.
--
-- The trips UPDATE policy is:
--   USING/CHECK ((auth.uid() = user_id) OR is_trip_collaborator(id, auth.uid(), true))
-- which lets a collaborator UPDATE *any* column — including user_id. By setting
-- user_id = themselves they become the owner (the WITH CHECK still passes,
-- because afterwards auth.uid() = user_id), and the owner-only DELETE policy
-- then lets them delete it. Net: any trip shared with edit permission could be
-- taken over or destroyed by the collaborator. Verified live (collab-deep D9):
-- editor B reassigned owner and deleted the trip.
--
-- RLS WITH CHECK only sees the NEW row, so it cannot compare against the old
-- user_id. A BEFORE UPDATE trigger is the correct guard: the owner column may
-- only change when the CURRENT user is the EXISTING owner (covers legitimate
-- ownership transfer by the real owner; blocks collaborators and everyone else).

CREATE OR REPLACE FUNCTION public.guard_trip_owner_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    -- only the existing owner may reassign ownership
    IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'permission denied: only the trip owner may change ownership'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_trip_owner_column ON public.trips;
CREATE TRIGGER trg_guard_trip_owner_column
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_trip_owner_column();

-- DELETE policy is already owner-only (auth.uid() = user_id); once ownership
-- can no longer be stolen, a collaborator can never satisfy it. No change needed.
