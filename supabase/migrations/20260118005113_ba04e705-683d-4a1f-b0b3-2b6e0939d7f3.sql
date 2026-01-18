-- Fix trip collaboration: Allow collaborators to view shared trips
DROP POLICY IF EXISTS "Users can view own trips" ON trips;

CREATE POLICY "Users can view own and collaborated trips"
ON trips
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM trip_collaborators 
      WHERE trip_collaborators.trip_id = trips.id 
      AND trip_collaborators.user_id = auth.uid() 
      AND trip_collaborators.accepted_at IS NOT NULL
    )
  )
);

-- Also allow collaborators with 'edit' permission to update trips
DROP POLICY IF EXISTS "Users can update own trips" ON trips;

CREATE POLICY "Users can update own or collaborated trips"
ON trips
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM trip_collaborators 
      WHERE trip_collaborators.trip_id = trips.id 
      AND trip_collaborators.user_id = auth.uid() 
      AND trip_collaborators.accepted_at IS NOT NULL
      AND trip_collaborators.permission IN ('edit', 'admin')
    )
  )
);