-- Fix infinite recursion in trips RLS policies caused by mutual references between trips and trip_collaborators

-- Create SECURITY DEFINER helper to check collaboration without invoking RLS
CREATE OR REPLACE FUNCTION public.is_trip_collaborator(
  p_trip_id uuid,
  p_user_id uuid,
  p_require_edit boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trip_collaborators tc
    WHERE tc.trip_id = p_trip_id
      AND tc.user_id = p_user_id
      AND tc.accepted_at IS NOT NULL
      AND (
        p_require_edit = false
        OR tc.permission = ANY (ARRAY['edit'::text, 'admin'::text])
      )
  );
$$;

-- Replace trips policies to use helper and avoid direct trip_collaborators subquery
DROP POLICY IF EXISTS "Users can view own and collaborated trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update own or collaborated trips" ON public.trips;

CREATE POLICY "Users can view own and collaborated trips"
ON public.trips
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_trip_collaborator(id, auth.uid(), false)
);

CREATE POLICY "Users can update own or collaborated trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_trip_collaborator(id, auth.uid(), true)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.is_trip_collaborator(id, auth.uid(), true)
);