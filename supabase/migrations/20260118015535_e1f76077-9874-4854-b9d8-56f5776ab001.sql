-- Drop existing policies on trips table
DROP POLICY IF EXISTS "Users can view own and collaborated trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update own or collaborated trips" ON public.trips;
DROP POLICY IF EXISTS "Users can create own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON public.trips;

-- Recreate with tighter security (no redundant auth.uid() IS NOT NULL checks)
-- SELECT: Only owner or accepted collaborators can view
CREATE POLICY "Users can view own and collaborated trips"
ON public.trips
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id)
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_collaborators.trip_id = trips.id
      AND trip_collaborators.user_id = auth.uid()
      AND trip_collaborators.accepted_at IS NOT NULL
  )
);

-- INSERT: Only owner can create their own trips
CREATE POLICY "Users can create own trips"
ON public.trips
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: Owner or collaborators with edit/admin permission
CREATE POLICY "Users can update own or collaborated trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_collaborators.trip_id = trips.id
      AND trip_collaborators.user_id = auth.uid()
      AND trip_collaborators.accepted_at IS NOT NULL
      AND trip_collaborators.permission IN ('edit', 'admin')
  )
);

-- DELETE: Only owner can delete
CREATE POLICY "Users can delete own trips"
ON public.trips
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);