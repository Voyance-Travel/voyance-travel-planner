-- R4: tighten profiles co-member visibility to ACCEPTED memberships only.
-- Previous policy let pending invitees see existing co-members' profiles AND
-- let existing members see pending invitees' profiles. Both directions now
-- require accepted_at IS NOT NULL on trip_members.

DROP POLICY IF EXISTS "Users can view profiles of trip co-members" ON public.profiles;

CREATE POLICY "Users can view profiles of trip co-members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT tm.user_id
    FROM public.trip_members tm
    WHERE tm.user_id IS NOT NULL
      AND tm.accepted_at IS NOT NULL
      AND tm.trip_id IN (
        SELECT tm2.trip_id
        FROM public.trip_members tm2
        WHERE tm2.user_id = auth.uid()
          AND tm2.accepted_at IS NOT NULL
      )
  )
);