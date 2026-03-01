
-- Fix trip_cities RLS: allow collaborators to view/manage trip cities

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their trip cities" ON public.trip_cities;
DROP POLICY IF EXISTS "Users can insert their trip cities" ON public.trip_cities;
DROP POLICY IF EXISTS "Users can update their trip cities" ON public.trip_cities;
DROP POLICY IF EXISTS "Users can delete their trip cities" ON public.trip_cities;

-- Recreate with collaborator access
CREATE POLICY "Users can view their trip cities"
  ON public.trip_cities FOR SELECT
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
  );

CREATE POLICY "Users can insert their trip cities"
  ON public.trip_cities FOR INSERT
  WITH CHECK (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their trip cities"
  ON public.trip_cities FOR UPDATE
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
    OR trip_id IN (SELECT trip_id FROM public.trip_collaborators WHERE user_id = auth.uid() AND accepted_at IS NOT NULL AND permission IN ('edit', 'admin'))
  );

CREATE POLICY "Users can delete their trip cities"
  ON public.trip_cities FOR DELETE
  USING (
    trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid())
  );
