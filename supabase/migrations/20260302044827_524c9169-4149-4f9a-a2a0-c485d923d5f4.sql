
-- Add optimistic locking version column to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS itinerary_version integer NOT NULL DEFAULT 1;

-- Create atomic optimistic update function
-- Returns the new version on success, or error on conflict
CREATE OR REPLACE FUNCTION public.optimistic_update_itinerary(
  p_trip_id uuid,
  p_expected_version integer,
  p_itinerary_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_version integer;
  v_actual_version integer;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Allow if owner OR accepted collaborator with edit permission
  IF NOT EXISTS (
    SELECT 1 FROM public.trips WHERE id = p_trip_id AND user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.trip_collaborators
    WHERE trip_id = p_trip_id 
      AND user_id = v_user_id 
      AND accepted_at IS NOT NULL
      AND permission IN ('edit', 'admin', 'editor', 'contributor')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Attempt atomic compare-and-swap
  UPDATE public.trips
  SET 
    itinerary_data = p_itinerary_data,
    itinerary_version = itinerary_version + 1,
    updated_at = now()
  WHERE id = p_trip_id
    AND itinerary_version = p_expected_version
  RETURNING itinerary_version INTO v_new_version;

  -- If no row was updated, version mismatch (conflict)
  IF v_new_version IS NULL THEN
    SELECT itinerary_version INTO v_actual_version
    FROM public.trips WHERE id = p_trip_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'version_conflict',
      'expected_version', p_expected_version,
      'actual_version', v_actual_version
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_version', v_new_version
  );
END;
$$;
